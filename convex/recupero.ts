import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { cesteFuori } from "./ceste";
import { asCliente, clienteShape } from "./clienti";
import { fuoriSince } from "./movimenti";
import { requireAdmin, requireOperatore } from "./operatori";
import { writeRegistroRow } from "./registro";
import { millSettings, saveMillSettings } from "./settings";

/** One Cesta on the list: which she is, and since when she has been Fuori. */
const cestaFuori = v.object({
  _id: v.id("ceste"),
  numero: v.number(),
  codice: v.string(),
  // The Ritiro that took her out, or the Rettifica that says she turned up in
  // somebody's yard — and nothing where she reached his hands some other way,
  // rather than a date the app would be inventing (ADR-0005).
  since: v.union(v.null(), v.number()),
});

/**
 * The Ceste a Cliente is holding, each dated, and the date of the oldest of
 * them: how long the mill has been waiting on this person, which is what the
 * list is sorted by and what a row is highlighted by.
 */
async function heldBy(ctx: QueryCtx, ceste: Doc<"ceste">[]) {
  const dated = await Promise.all(
    ceste.map(async (cesta) => ({
      _id: cesta._id,
      numero: cesta.numero,
      codice: cesta.codice,
      since: await fuoriSince(ctx, cesta._id),
    })),
  );
  const dates = dated.flatMap((cesta) => cesta.since ?? []);
  return {
    since: dates.length === 0 ? null : Math.min(...dates),
    ceste: dated,
  };
}

/**
 * The Ceste Fuori, one group per Cliente holding them, in the order the Ceste
 * are read: by numero, inside a group as between them.
 *
 * A Cesta the app has as nobody's is left out, because a row of this list is
 * somebody to telephone and that one names nobody to call. No mutation can
 * leave a Cesta there — Fuori with nobody is not a place a Cesta can be — and
 * `ceste.fuoriByCliente` is the fleet-wide read where one would show if a
 * deployment ever held one.
 */
function byCliente(ceste: Doc<"ceste">[]): Map<Id<"clienti">, Doc<"ceste">[]> {
  const groups = new Map<Id<"clienti">, Doc<"ceste">[]>();
  for (const cesta of ceste) {
    if (cesta.clienteId !== undefined) {
      groups.set(cesta.clienteId, [
        ...(groups.get(cesta.clienteId) ?? []),
        cesta,
      ]);
    }
  }
  return groups;
}

/**
 * The Lista di recupero: every Cliente holding Ceste right now, worst first,
 * with the Soglia di ritardo the screen highlights by.
 *
 * Never filtered, by the Soglia or by anything else. A mill that cannot see
 * whom it lent a Cesta to cannot ask for it back, so the one screen that
 * exists to find Ceste can hide nobody: the Soglia comes back beside the list
 * rather than narrowing it (CONTEXT.md, #22).
 *
 * Readable by every Operatore, because telephoning somebody on a quiet
 * afternoon should not need an Admin (spec #1).
 */
export const list = query({
  args: {},
  returns: v.object({
    // Beside the list rather than inside it: the screen decides which rows it
    // colours, and the query decides nothing at all by it.
    sogliaRitardo: v.number(),
    clienti: v.array(
      v.object({
        cliente: v.object(clienteShape),
        // A Cliente the mill has written off is still holding its Ceste, and
        // the row says so rather than dropping him (ADR-0004, #22).
        active: v.boolean(),
        // Since when this Cliente has been holding the oldest Cesta he has:
        // how long the mill has been waiting on him, and what the list is
        // ordered by.
        since: v.union(v.null(), v.number()),
        ceste: v.array(cestaFuori),
      }),
    ),
  }),
  handler: async (ctx) => {
    await requireOperatore(ctx);
    const { sogliaRitardo } = await millSettings(ctx);
    const groups = byCliente(await cesteFuori(ctx));

    const clienti = await Promise.all(
      [...groups].map(async ([clienteId, ceste]) => {
        const cliente = await ctx.db.get(clienteId);
        if (cliente === null) {
          // A Cliente is deactivated but never deleted (ADR-0004).
          throw new Error("A Cesta Fuori names a Cliente that is gone.");
        }
        return {
          cliente: asCliente(cliente),
          active: cliente.active,
          ...(await heldBy(ctx, ceste)),
        };
      }),
    );

    // Worst first: whoever has been holding a Cesta longest heads the list. A
    // Cliente whose Ceste carry no date goes last rather than first — the app
    // does not know how long he has had them, and guessing would put a name
    // the mill has nothing on above the ones it does. Ties break on the numero
    // the Ceste are read in, so that the screen never reshuffles between reads.
    clienti.sort((one, other) => {
      if (one.since !== other.since) {
        return (one.since ?? Infinity) - (other.since ?? Infinity);
      }
      return one.ceste[0].numero - other.ceste[0].numero;
    });
    return { sogliaRitardo, clienti };
  },
});

/**
 * An Admin settles how many days a Cesta may be Fuori before the Lista di
 * recupero calls her In ritardo. One value for the whole mill (CONTEXT.md).
 *
 * It moves no Cesta and takes nobody off the list: all it decides is which
 * rows are highlighted. That is the whole point of the setting being safe to
 * get wrong — a mill that sets it to a hundred days sees the same names in the
 * same order, in plainer colours (#22).
 *
 * The Registro row names what the Soglia said before and what it says now
 * (ADR-0006); setting it to what it already says changes nothing, and nothing
 * changed is nothing to record.
 */
export const setSogliaRitardo = mutation({
  args: { days: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!Number.isInteger(args.days) || args.days < 1) {
      throw new Error(
        "The Soglia di ritardo is a whole number of days, one or more.",
      );
    }

    const before = (await millSettings(ctx)).sogliaRitardo;
    if (before === args.days) {
      return null;
    }

    await saveMillSettings(ctx, { sogliaRitardo: args.days });
    await writeRegistroRow(ctx, {
      operatoreId: admin._id,
      action: { kind: "soglia_ritardo", before, after: args.days },
    });
    return null;
  },
});
