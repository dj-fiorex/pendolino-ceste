import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { asCliente, clienteShape } from "./clienti";
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
 * (ADR-0005). Saying plainly that she was not where the app believed, and
 * writing the Rettifica that records it, is #21's.
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
      cliente: cesta.state === "fuori" ? await clienteWith(ctx, cesta) : null,
    };
  },
});

/**
 * The Ceste back at the mill and still full, by numero, each with the Cliente
 * whose name the paper tape carries. This is the list the yard is walked with:
 * what the app believes is waiting to be milled, read against the tapes on the
 * Ceste themselves.
 *
 * The Svuotamento screen of #18 is this same read, grouped by Cliente and laid
 * out for hands that have been in the olives.
 */
export const attesaMolitura = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("ceste"),
      numero: v.number(),
      codice: v.string(),
      portata,
      cliente: v.union(v.null(), v.object(clienteShape)),
    }),
  ),
  handler: async (ctx) => {
    await requireOperatore(ctx);
    const waiting = await ctx.db
      .query("ceste")
      .withIndex("by_state", (q) => q.eq("state", "attesa_molitura"))
      .collect();
    // A Dismessa Cesta is not in Attesa molitura anyway, but every read that
    // fills a list filters on the active flag regardless (ADR-0004).
    const ceste = waiting.filter((cesta) => cesta.active);

    // A yard of forty Ceste is a handful of Clienti: each of them is read once,
    // not once per Cesta bearing their name.
    const clienti = new Map(
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

    return ceste
      .sort((one, other) => one.numero - other.numero)
      .map((cesta) => ({
        _id: cesta._id,
        numero: cesta.numero,
        codice: cesta.codice,
        portata: cesta.portata,
        cliente:
          cesta.clienteId === undefined
            ? null
            : (clienti.get(cesta.clienteId) ?? null),
      }));
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
