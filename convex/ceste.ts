import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
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
    };
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
