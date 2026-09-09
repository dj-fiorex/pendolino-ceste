import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { byCliente, cesteFuori } from "./ceste";
import { asCliente, clienteShape } from "./clienti";
import { fuoriSince } from "./movimenti";
import { requireAdmin, requireOperatore } from "./operatori";
import { writeRegistroRow } from "./registro";
import { millSettings } from "./settings";

/**
 * One Cesta on the list: which she is, and since when she has been Fuori.
 *
 * Her numero and no Codice, because this is a list read out over a telephone
 * — "hai ancora la 17 e la 22" — and at the counter one says the numero
 * (ADR-0007).
 */
const cestaOnTheList = v.object({
  _id: v.id("ceste"),
  numero: v.number(),
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
async function whatHeHolds(ctx: QueryCtx, ceste: Doc<"ceste">[]) {
  const dated = await Promise.all(
    ceste.map(async (cesta) => ({
      _id: cesta._id,
      numero: cesta.numero,
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
        ceste: v.array(cestaOnTheList),
      }),
    ),
  }),
  handler: async (ctx) => {
    await requireOperatore(ctx);
    const { sogliaRitardo } = await millSettings(ctx);
    // A group the app has as nobody's is left out: a row of this list is
    // somebody to telephone, and that one names nobody to call. No mutation
    // can make one — Fuori with nobody is not a place a Cesta can be — and
    // `ceste.fuoriByCliente` is the fleet-wide read where one would show.
    const groups = byCliente(await cesteFuori(ctx)).flatMap((group) =>
      group.clienteId === undefined
        ? []
        : [{ clienteId: group.clienteId, ceste: group.ceste }],
    );

    const clienti = await Promise.all(
      groups.map(async ({ clienteId, ceste }) => {
        const cliente = await ctx.db.get(clienteId);
        if (cliente === null) {
          // A Cliente is deactivated but never deleted (ADR-0004), so this is
          // a broken invariant rather than a Cliente who left. It is raised
          // rather than quietly dropped: the one screen that exists to find
          // Ceste must not be the one that loses them.
          throw new Error("A Cesta Fuori names a Cliente that is gone.");
        }
        return {
          cliente: asCliente(cliente),
          active: cliente.active,
          ...(await whatHeHolds(ctx, ceste)),
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
