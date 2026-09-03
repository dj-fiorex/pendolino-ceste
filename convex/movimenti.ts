import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { requireOperatore } from "./operatori";
import { writeRegistroRow } from "./registro";
import { movimentoKind, type State } from "./schema";

/**
 * The two movements at the counter, each as what it is called and where it
 * leaves the Ceste it moved. Everything else about them is one gesture — the
 * Cliente in front of the Operatore, then their Ceste one at a time — which is
 * why one function records both.
 *
 * The Svuotamento of #18 is not one of these: nobody is at the counter for it
 * and it carries no Cliente.
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
