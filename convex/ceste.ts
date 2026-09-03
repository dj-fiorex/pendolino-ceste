import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { asCliente, clienteShape } from "./clienti";
import { lastMovimentoAt } from "./movimenti";
import { requireAdmin, requireOperatore } from "./operatori";
import { writeRegistroRow } from "./registro";
import { forma, portata, state, type Forma, type Portata } from "./schema";

/**
 * The largest Censimento the mill can mean. Its whole fleet is about 195
 * Ceste, so a bigger number is a slip of the finger rather than a delivery —
 * and one Censimento has to fit in one Convex transaction to hand out one
 * gap-free run of numeri.
 */
const MAX_CESTE_PER_CENSIMENTO = 500;

/** Both Portate, in the order the mill says them: 400 kg is most of the fleet. */
const PORTATE = portata.members.map((member) => member.value);

/**
 * The Codice printed on a Cesta's Etichetta and carried by its QR code: the
 * Portata, the Forma as Q or R, and the numero to three digits — `400-R-017`,
 * `250-Q-171`. Computed at Censimento and never recomputed (ADR-0007).
 */
const codiceOf = (portata: Portata, forma: Forma, numero: number) =>
  `${portata}-${forma === "quadrata" ? "Q" : "R"}-${String(numero).padStart(3, "0")}`;

/**
 * A Censimento: the Admin enters Ceste of one Portata and one Forma, and the
 * app hands each of them its numero and its Codice. A Cesta bought part-way
 * through a Campagna is a Censimento of one.
 *
 * Returns the run of numeri just created, so that the screen can offer the
 * Etichette for exactly those Ceste (#29).
 */
export const censimento = mutation({
  args: { portata, forma, count: v.number() },
  returns: v.object({ fromNumero: v.number(), toNumero: v.number() }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (
      !Number.isInteger(args.count) ||
      args.count < 1 ||
      args.count > MAX_CESTE_PER_CENSIMENTO
    ) {
      throw new Error(
        `A Censimento covers between 1 and ${MAX_CESTE_PER_CENSIMENTO} Ceste.`,
      );
    }

    // The next numero is the highest ever handed out plus one, read inside the
    // mutation Convex runs transactionally: a Censimento of a hundred is one
    // gap-free run, and no numero is ever handed out twice. Nothing frees a
    // numero either — a Dismessa Cesta keeps hers (ADR-0007, ADR-0004).
    const highestNumbered = await ctx.db
      .query("ceste")
      .withIndex("by_numero")
      .order("desc")
      .first();
    const fromNumero = (highestNumbered?.numero ?? 0) + 1;
    const toNumero = fromNumero + args.count - 1;

    for (let numero = fromNumero; numero <= toNumero; numero++) {
      await ctx.db.insert("ceste", {
        numero,
        portata: args.portata,
        forma: args.forma,
        codice: codiceOf(args.portata, args.forma, numero),
        // Every Cesta starts at the mill, empty, ready for the next Cliente.
        state: "disponibile",
        active: true,
      });
    }

    // One row for the whole Censimento, however many Ceste it covers
    // (ADR-0006).
    await writeRegistroRow(ctx, {
      operatoreId: admin._id,
      action: {
        kind: "censimento",
        portata: args.portata,
        forma: args.forma,
        count: args.count,
        fromNumero,
        toNumero,
      },
    });

    return { fromNumero, toNumero };
  },
});

/**
 * The whole fleet, by numero: what exists, of which Portata and Forma, and
 * where each Cesta is. Dismesse Ceste are listed too — this is the fleet
 * screen, not a picker or a count, and a retired Cesta is part of the fleet's
 * history (ADR-0004).
 */
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      numero: v.number(),
      codice: v.string(),
      portata,
      forma,
      state,
    }),
  ),
  handler: async (ctx) => {
    await requireOperatore(ctx);
    const ceste = await ctx.db.query("ceste").withIndex("by_numero").collect();
    return ceste.map((cesta) => ({
      numero: cesta.numero,
      codice: cesta.codice,
      portata: cesta.portata,
      forma: cesta.forma,
      state: cesta.state,
    }));
  },
});

/**
 * The Cliente a Cesta is with, as every screen names them, or nobody where the
 * Cesta is with nobody. A Cliente is deactivated but never deleted (ADR-0004),
 * so a Cesta that names one always finds them.
 */
async function clienteWith(ctx: QueryCtx, cesta: Doc<"ceste">) {
  if (cesta.clienteId === undefined) {
    return null;
  }
  const cliente = await ctx.db.get(cesta.clienteId);
  return cliente === null ? null : asCliente(cliente);
}

/**
 * The numero as the Operatore types it: a Cesta wears her numero to three
 * digits on her Etichetta, and at the counter one types 17 or 017 for the same
 * Cesta. Anything that is not a numero at all is nobody's.
 */
const readNumero = (typed: string): number | null => {
  const digits = typed.trim();
  if (!/^\d+$/.test(digits)) {
    return null;
  }
  const numero = Number(digits);
  return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
};

/**
 * The Cesta answering to a typed numero, or null when none does, so that the
 * screen can say so and add nothing (spec #1, story 57). The full Codice comes
 * back with her: a glance at `400-R-017` confirms the right Cesta without
 * anybody typing the prefix.
 *
 * She comes back with the Cliente the app believes is holding her, which is how
 * a Rientro finds whose the load is without anybody being searched for: the
 * Operatore reads one numero off the trailer and the app names the Cliente
 * (#17).
 *
 * Whatever state she is in, she comes back: the counter is never blocked
 * (ADR-0005). Saying so plainly on the counter screens, and writing the
 * Rettifica that records it there, is #21's — the Svuotamento already does
 * both (#18).
 */
export const byNumero = query({
  args: { numero: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("ceste"),
      numero: v.number(),
      codice: v.string(),
      portata,
      // Where the app believes she is. Nothing refuses her for it (ADR-0005);
      // it comes back so that a screen can say what it is about to correct —
      // "400-R-005 risulta Fuori: verrà svuotata con una Rettifica" (#18).
      state,
      // Whom the app believes is holding her, and nobody unless she is Fuori:
      // a Cesta at the mill is in nobody's hands, and one in Attesa molitura
      // wears a name on her tape rather than being held. Either way the
      // Rientro falls back to the Cliente search (#16).
      cliente: v.union(v.null(), v.object(clienteShape)),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOperatore(ctx);
    const numero = readNumero(args.numero);
    if (numero === null) {
      return null;
    }
    const cesta = await ctx.db
      .query("ceste")
      .withIndex("by_numero", (q) => q.eq("numero", numero))
      .unique();
    if (cesta === null) {
      return null;
    }
    return {
      _id: cesta._id,
      numero: cesta.numero,
      codice: cesta.codice,
      portata: cesta.portata,
      state: cesta.state,
      cliente: cesta.state === "fuori" ? await clienteWith(ctx, cesta) : null,
    };
  },
});

/** The Ceste back at the mill and still full, by numero. */
async function inAttesaMolitura(ctx: QueryCtx): Promise<Doc<"ceste">[]> {
  const waiting = await ctx.db
    .query("ceste")
    .withIndex("by_state", (q) => q.eq("state", "attesa_molitura"))
    .collect();
  // A Dismessa Cesta is not in Attesa molitura anyway, but every read that
  // fills a list filters on the active flag regardless (ADR-0004).
  return waiting
    .filter((cesta) => cesta.active)
    .sort((one, other) => one.numero - other.numero);
}

/**
 * The Clienti a set of Ceste names, as every screen names them. A yard of
 * forty Ceste is a handful of Clienti: each of them is read once, not once per
 * Cesta bearing their name.
 */
async function clientiHolding(ctx: QueryCtx, ceste: Doc<"ceste">[]) {
  return new Map(
    (
      await Promise.all(
        [...new Set(ceste.flatMap((cesta) => cesta.clienteId ?? []))].map(
          (clienteId) => ctx.db.get(clienteId),
        ),
      )
    ).flatMap((cliente) =>
      // A Cliente is deactivated but never deleted (ADR-0004).
      cliente === null ? [] : [[cliente._id, asCliente(cliente)] as const],
    ),
  );
}

/**
 * The Ceste of a set, one group per Cliente named on them, with the Ceste the
 * app believes are nobody's — none, unless a Rettifica put one there — as one
 * group of their own rather than as one group each. The order inside a group
 * is the order they came in, which both readers set by numero.
 */
function byCliente(ceste: Doc<"ceste">[]): Doc<"ceste">[][] {
  const groups = new Map<string, Doc<"ceste">[]>();
  for (const cesta of ceste) {
    const key = cesta.clienteId ?? "";
    groups.set(key, [...(groups.get(key) ?? []), cesta]);
  }
  return [...groups.values()];
}

/** A Cesta as a tile or a row of the yard shows her. */
const waitingCesta = {
  _id: v.id("ceste"),
  numero: v.number(),
  codice: v.string(),
  portata,
};

const asWaitingCesta = (cesta: Doc<"ceste">) => ({
  _id: cesta._id,
  numero: cesta.numero,
  codice: cesta.codice,
  portata: cesta.portata,
});

/**
 * The Ceste back at the mill and still full, by numero, each with the Cliente
 * whose name the paper tape carries. This is the list the yard is walked with:
 * what the app believes is waiting to be milled, read against the tapes on the
 * Ceste themselves.
 */
export const attesaMolitura = query({
  args: {},
  returns: v.array(
    v.object({
      ...waitingCesta,
      cliente: v.union(v.null(), v.object(clienteShape)),
    }),
  ),
  handler: async (ctx) => {
    await requireOperatore(ctx);
    const ceste = await inAttesaMolitura(ctx);
    const clienti = await clientiHolding(ctx, ceste);
    return ceste.map((cesta) => ({
      ...asWaitingCesta(cesta),
      cliente:
        cesta.clienteId === undefined
          ? null
          : (clienti.get(cesta.clienteId) ?? null),
    }));
  },
});

/**
 * The same Ceste, grouped as the Svuotamento screen empties them: one group
 * per Cliente, because the Cliente is what the paper tape says, and oldest
 * Rientro first, because that is the load that has been waiting longest (#18).
 *
 * A Cliente whose Ceste came back over several days is one group all the same,
 * dated by the oldest Rientro among them: whoever empties them works from the
 * tapes, and the tapes say a name rather than a load. The Ceste inside a group
 * come by numero, which is the order they are stacked and read in.
 */
export const attesaMolituraByCliente = query({
  args: {},
  returns: v.array(
    v.object({
      cliente: v.union(v.null(), v.object(clienteShape)),
      // The oldest Rientro in the group: the date on its header. A Cesta that
      // reached Attesa molitura some other way has none, and a group of only
      // such Ceste says so rather than inventing a date.
      oldestRientro: v.union(v.null(), v.number()),
      ceste: v.array(v.object(waitingCesta)),
    }),
  ),
  handler: async (ctx) => {
    await requireOperatore(ctx);
    const ceste = await inAttesaMolitura(ctx);
    const clienti = await clientiHolding(ctx, ceste);

    // Grouped on the Cliente the tape names, which is whose the load is.
    const dated = await Promise.all(
      byCliente(ceste).map(async (group) => {
        const rientri = await Promise.all(
          group.map((cesta) => lastMovimentoAt(ctx, cesta._id, "rientro")),
        );
        const known = rientri.filter((at) => at !== null);
        const [first] = group;
        return {
          cliente:
            first.clienteId === undefined
              ? null
              : (clienti.get(first.clienteId) ?? null),
          oldestRientro: known.length === 0 ? null : Math.min(...known),
          ceste: group.map(asWaitingCesta),
        };
      }),
    );

    // Longest wait first. A group with no Rientro to date goes last rather than
    // first, and ties — two Clienti whose Ceste came in on the same Rientro,
    // which one Movimento apart is all it takes — break on the numero the
    // Ceste are read in, so that the screen never reshuffles between reads.
    return dated.sort((one, other) => {
      if (one.oldestRientro !== other.oldestRientro) {
        return (
          (one.oldestRientro ?? Infinity) - (other.oldestRientro ?? Infinity)
        );
      }
      return one.ceste[0].numero - other.ceste[0].numero;
    });
  },
});

/**
 * The Ceste out with somebody right now, one group per Cliente, by name: which
 * Ceste are still Fuori and who holds them.
 *
 * What an Admin closing a Campagna is shown before they go ahead, since
 * closing moves none of them (#19). The Lista di recupero reads the same fact
 * with the dates and the telephone that chasing them needs (#22).
 */
export const fuoriByCliente = query({
  args: {},
  returns: v.array(
    v.object({
      cliente: v.union(v.null(), v.object(clienteShape)),
      ceste: v.array(v.object({ numero: v.number(), codice: v.string() })),
    }),
  ),
  handler: async (ctx) => {
    await requireOperatore(ctx);
    const ceste = (
      await ctx.db
        .query("ceste")
        .withIndex("by_state", (q) => q.eq("state", "fuori"))
        .collect()
    ).sort((one, other) => one.numero - other.numero);
    const clienti = await clientiHolding(ctx, ceste);

    // Grouped on the Cliente the Cesta went out to, which is who to call.
    const groups = byCliente(ceste).map((group) => {
      const [first] = group;
      return {
        cliente:
          first.clienteId === undefined
            ? null
            : (clienti.get(first.clienteId) ?? null),
        ceste: group.map((cesta) => ({
          numero: cesta.numero,
          codice: cesta.codice,
        })),
      };
    });

    // By name, as every list of Clienti is read, and the Ceste nobody is
    // holding last, where a name would have been.
    return groups.sort((one, other) => {
      if (one.cliente === null || other.cliente === null) {
        return (
          (one.cliente === null ? 1 : 0) - (other.cliente === null ? 1 : 0)
        );
      }
      return one.cliente.name.localeCompare(other.cliente.name, "it");
    });
  },
});

/**
 * How many Ceste are Disponibile right now, by Portata: the number an
 * Operatore needs before promising a Cliente containers. The Forma never
 * splits it (ADR-0007), and both Portate are always reported, so that none
 * reads as an absence rather than as a zero.
 */
export const disponibiliByPortata = query({
  args: {},
  returns: v.array(v.object({ portata, count: v.number() })),
  handler: async (ctx) => {
    await requireOperatore(ctx);
    const disponibili = await ctx.db
      .query("ceste")
      .withIndex("by_state", (q) => q.eq("state", "disponibile"))
      .collect();
    // A Dismessa Cesta is not Disponibile anyway, but every count filters on
    // the active flag regardless (ADR-0004).
    const activeCeste = disponibili.filter((cesta) => cesta.active);
    return PORTATE.map((portata) => ({
      portata,
      count: activeCeste.filter((cesta) => cesta.portata === portata).length,
    }));
  },
});
