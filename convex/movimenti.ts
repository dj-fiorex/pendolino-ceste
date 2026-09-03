import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireOperatore } from "./operatori";
import { writeRegistroRow } from "./registro";
import {
  movimentoKind,
  rettificaFields,
  type MovimentoKind,
  type State,
} from "./schema";

/**
 * When the newest Movimento of a kind against a Cesta happened, or nothing
 * where there is none. A Cesta is Fuori since her last Ritiro (#17, #22) and a
 * Cliente's stack has been waiting since their oldest Rientro (#18) — both are
 * this read.
 *
 * A Cesta that reached a state some other way has no such Movimento and says
 * so, rather than inventing a date: the Movimenti are a record of events, not
 * a ledger that balances (ADR-0005).
 */
export async function lastMovimentoAt(
  ctx: QueryCtx,
  cestaId: Id<"ceste">,
  kind: MovimentoKind,
): Promise<number | null> {
  const movimento = await ctx.db
    .query("movimenti")
    .withIndex("by_cesta_and_kind", (q) =>
      q.eq("cestaId", cestaId).eq("kind", kind),
    )
    .order("desc")
    .first();
  return movimento?._creationTime ?? null;
}

/**
 * The two movements at the counter, each as what it is called and where it
 * leaves the Ceste it moved. Everything else about them is one gesture — the
 * Cliente in front of the Operatore, then their Ceste one at a time — which is
 * why one function records both.
 *
 * The Svuotamento is not one of these: nobody is at the counter for it and it
 * carries no Cliente.
 */
const atTheCounter = {
  ritiro: { name: "Ritiro", becomes: "fuori" },
  rientro: { name: "Rientro", becomes: "attesa_molitura" },
} as const satisfies Record<string, { name: string; becomes: State }>;

type CounterMovimento = keyof typeof atTheCounter;

/** What either movement at the counter is: a Cliente, and the Ceste added. */
const counterArgs = {
  clienteId: v.id("clienti"),
  cesteIds: v.array(v.id("ceste")),
};

/**
 * A movement at the counter: the Ceste the Operatore has added, one at a time,
 * all move together under the Cliente in front of them. One Movimento per
 * Cesta, all of them under the one Registro row that says what the Operatore
 * did (ADR-0006).
 *
 * Nothing here refuses a Cesta for the state she is in — Fuori with somebody
 * else, still in Attesa molitura, or never taken out at all. The Cesta is in
 * the yard and the Cliente is loading her: the app records what happens rather
 * than authorising it, and a Cesta on the wrong trailer is exactly the fact the
 * mill has never been able to see (ADR-0005). Reporting those mismatches as a
 * Rettifica is #21's.
 *
 * The Cliente moved to is always the one actually present, which is what makes
 * a Rientro of somebody else's Cesta come to rest under the name the paper tape
 * will carry (#17).
 */
async function recordAtTheCounter(
  ctx: MutationCtx,
  kind: CounterMovimento,
  args: { clienteId: Id<"clienti">; cesteIds: Id<"ceste">[] },
): Promise<null> {
  const { name, becomes } = atTheCounter[kind];
  const operatore = await requireOperatore(ctx);
  const cliente = await ctx.db.get(args.clienteId);
  if (cliente === null) {
    throw new Error("This Cliente is not in the registry.");
  }

  // The same Cesta added twice — scanned and then typed, say — is one Cesta
  // moved once.
  const cesteIds = [...new Set(args.cesteIds)];
  if (cesteIds.length === 0) {
    throw new Error(`A ${name} takes at least one Cesta.`);
  }
  const ceste = await Promise.all(cesteIds.map((id) => ctx.db.get(id)));
  if (ceste.some((cesta) => cesta === null)) {
    throw new Error(`A Cesta in this ${name} is not in the fleet.`);
  }
  const inFleet = ceste.flatMap((cesta) => (cesta === null ? [] : [cesta]));

  const registroId = await writeRegistroRow(ctx, {
    operatoreId: operatore._id,
    clienteId: cliente._id,
    action: {
      kind,
      numeri: inFleet.map((cesta) => cesta.numero).sort((a, b) => a - b),
    },
  });

  for (const cesta of inFleet) {
    await ctx.db.patch(cesta._id, { state: becomes, clienteId: cliente._id });
    await ctx.db.insert("movimenti", {
      kind,
      cestaId: cesta._id,
      clienteId: cliente._id,
      operatoreId: operatore._id,
      registroId,
    });
  }
  return null;
}

/**
 * A Ritiro: the Ceste the Operatore has added go out with the Cliente at the
 * counter, and the mill can answer who is holding what.
 */
export const ritiro = mutation({
  args: counterArgs,
  returns: v.null(),
  handler: (ctx, args) => recordAtTheCounter(ctx, "ritiro", args),
});

/**
 * A Rientro: the Cliente drives back in with a load of full Ceste, and they
 * come to rest in Attesa molitura, where the paper tape in the yard already
 * says they are.
 *
 * What comes back is what the Operatore added, and nothing else moves: the two
 * Ceste of six that stayed on the farm are still Fuori afterwards, still
 * counted against the same Cliente. There is no code here about partial
 * returns, because a partial return is only a Rientro of fewer Ceste (#17).
 */
export const rientro = mutation({
  args: counterArgs,
  returns: v.null(),
  handler: (ctx, args) => recordAtTheCounter(ctx, "rientro", args),
});

/**
 * A Svuotamento: the Ceste selected on the tile screen are tipped out, their
 * paper tapes come off, and every one of them is Disponibile again — all on
 * one tap, because a stack of eight is one gesture and not eight.
 *
 * No Cliente anywhere. The load stops being anybody's the moment it is in the
 * mill, and so does the Cesta the moment she is empty. Whoever is signed in on
 * the device is the Operatore the Registro names: there is no station account
 * (#18).
 *
 * A Cesta the app did not believe to be in Attesa molitura is emptied all the
 * same, with a Rettifica beside her carrying the belief it corrected. She is
 * standing full in the mill whatever the app thinks — her Rientro was never
 * registered, or she never went out at all — and refusing her would only send
 * somebody with olives on their hands back to the counter (ADR-0005).
 */
export const svuotamento = mutation({
  args: { cesteIds: v.array(v.id("ceste")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const operatore = await requireOperatore(ctx);

    // The same Cesta twice — tapped on her tile and then typed on the keypad —
    // is one Cesta emptied once.
    const cesteIds = [...new Set(args.cesteIds)];
    if (cesteIds.length === 0) {
      throw new Error("A Svuotamento takes at least one Cesta.");
    }
    const ceste = await Promise.all(cesteIds.map((id) => ctx.db.get(id)));
    if (ceste.some((cesta) => cesta === null)) {
      throw new Error("A Cesta in this Svuotamento is not in the fleet.");
    }
    const inFleet = ceste.flatMap((cesta) => (cesta === null ? [] : [cesta]));

    const registroId = await writeRegistroRow(ctx, {
      operatoreId: operatore._id,
      action: {
        kind: "svuotamento",
        numeri: inFleet.map((cesta) => cesta.numero).sort((a, b) => a - b),
      },
    });

    for (const cesta of inFleet) {
      // Written before she moves, and under the same Registro row as the
      // Svuotamento that moved her: the correction and the movement are one
      // action a person took (ADR-0006).
      if (cesta.state !== "attesa_molitura") {
        await ctx.db.insert("movimenti", {
          kind: "rettifica",
          cestaId: cesta._id,
          clienteId: cesta.clienteId,
          operatoreId: operatore._id,
          registroId,
          rettifica: { cause: "discrepanza", believedState: cesta.state },
        });
      }
      // Empty, at the mill, in nobody's hands: the Cliente goes with the tape.
      // A Cesta the app had written off comes back Disponibile and still
      // inactive, which is a row nothing yet reads and nothing yet writes:
      // putting a Cesta back into the fleet is a Rettifica of ritrovata, and it
      // is #20's to say whether emptying one counts as finding her.
      await ctx.db.patch(cesta._id, {
        state: "disponibile",
        clienteId: undefined,
      });
      await ctx.db.insert("movimenti", {
        kind: "svuotamento",
        cestaId: cesta._id,
        operatoreId: operatore._id,
        registroId,
      });
    }
    return null;
  },
});

/**
 * One Cesta's own history, newest first: every Movimento recorded against her,
 * with the Cliente it named and the Operatore who registered it.
 *
 * This is where a Rettifica reads beside the Movimento that produced it — what
 * the app believed, kept next to what actually happened, which is the pair the
 * whole project exists to show (ADR-0005).
 */
export const byCesta = query({
  args: { cestaId: v.id("ceste") },
  returns: v.array(
    v.object({
      kind: movimentoKind,
      // The Cliente the Movimento named, and nobody where it named none.
      cliente: v.union(
        v.null(),
        v.object({ name: v.string(), alias: v.array(v.string()) }),
      ),
      operatore: v.string(),
      at: v.number(),
      registroId: v.id("registro"),
      // What a Rettifica corrected, and nothing on every other kind.
      rettifica: v.union(v.null(), v.object(rettificaFields)),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOperatore(ctx);
    const movimenti = await ctx.db
      .query("movimenti")
      .withIndex("by_cesta", (q) => q.eq("cestaId", args.cestaId))
      .order("desc")
      .collect();
    return await Promise.all(
      movimenti.map(async (movimento) => {
        const operatore = await ctx.db.get(movimento.operatoreId);
        const cliente =
          movimento.clienteId === undefined
            ? null
            : await ctx.db.get(movimento.clienteId);
        if (operatore === null) {
          // Neither an Operatore nor a Cliente is ever deleted (ADR-0004).
          throw new Error("A Movimento names an Operatore that is gone.");
        }
        return {
          kind: movimento.kind,
          cliente:
            cliente === null
              ? null
              : { name: cliente.name, alias: cliente.alias },
          operatore: operatore.name,
          at: movimento._creationTime,
          registroId: movimento.registroId,
          rettifica: movimento.rettifica ?? null,
        };
      }),
    );
  },
});

/**
 * Everything a Cliente's Ceste have done, newest first: what they took, when,
 * and which Operatore registered it. The Cliente's own page reads it, and it is
 * the answer to "we took four, not six" at the counter.
 */
export const byCliente = query({
  args: { clienteId: v.id("clienti") },
  returns: v.array(
    v.object({
      kind: movimentoKind,
      numero: v.number(),
      codice: v.string(),
      operatore: v.string(),
      at: v.number(),
      // The action this Movimento was part of, which the Registro groups by.
      registroId: v.id("registro"),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOperatore(ctx);
    const movimenti = await ctx.db
      .query("movimenti")
      .withIndex("by_cliente", (q) => q.eq("clienteId", args.clienteId))
      .order("desc")
      .collect();
    return await Promise.all(
      movimenti.map(async (movimento) => {
        const cesta = await ctx.db.get(movimento.cestaId);
        const operatore = await ctx.db.get(movimento.operatoreId);
        if (cesta === null || operatore === null) {
          // Neither is ever deleted (ADR-0004).
          throw new Error(
            "A Movimento names a Cesta or an Operatore that is gone.",
          );
        }
        return {
          kind: movimento.kind,
          numero: cesta.numero,
          codice: cesta.codice,
          operatore: operatore.name,
          at: movimento._creationTime,
          registroId: movimento.registroId,
        };
      }),
    );
  },
});
