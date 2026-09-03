import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireOperatore } from "./operatori";
import { writeRegistroRow } from "./registro";
import { movimentoKind } from "./schema";

/**
 * A Ritiro: the Ceste the Operatore has added, one at a time, go out with the
 * Cliente at the counter. One Movimento per Cesta, all of them under the one
 * Registro row that says what the Operatore did (ADR-0006).
 *
 * Nothing here refuses a Cesta for the state she is in — Fuori with somebody
 * else, or still in Attesa molitura. The Cesta is in the yard and the Cliente
 * is loading her: the app records what happens rather than authorising it, and
 * a Cesta on the wrong trailer is exactly the fact the mill has never been able
 * to see (ADR-0005). Reporting those mismatches as a Rettifica is #21's.
 */
export const ritiro = mutation({
  args: {
    clienteId: v.id("clienti"),
    cesteIds: v.array(v.id("ceste")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const operatore = await requireOperatore(ctx);
    const cliente = await ctx.db.get(args.clienteId);
    if (cliente === null) {
      throw new Error("This Cliente is not in the registry.");
    }

    // The same Cesta added twice — scanned and then typed, say — is one Cesta
    // handed over once.
    const cesteIds = [...new Set(args.cesteIds)];
    if (cesteIds.length === 0) {
      throw new Error("A Ritiro takes at least one Cesta.");
    }
    const ceste = await Promise.all(cesteIds.map((id) => ctx.db.get(id)));
    if (ceste.some((cesta) => cesta === null)) {
      throw new Error("A Cesta in this Ritiro is not in the fleet.");
    }
    const inFleet = ceste.flatMap((cesta) => (cesta === null ? [] : [cesta]));

    const registroId = await writeRegistroRow(ctx, operatore._id, {
      kind: "ritiro",
      clienteId: cliente._id,
      numeri: inFleet.map((cesta) => cesta.numero).sort((a, b) => a - b),
    });

    for (const cesta of inFleet) {
      await ctx.db.patch(cesta._id, {
        state: "fuori",
        clienteId: cliente._id,
      });
      await ctx.db.insert("movimenti", {
        kind: "ritiro",
        cestaId: cesta._id,
        clienteId: cliente._id,
        operatoreId: operatore._id,
        registroId,
      });
    }
    return null;
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
      // The action this Movimento was part of, which #27 groups by.
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
