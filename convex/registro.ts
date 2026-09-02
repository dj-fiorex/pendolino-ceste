import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query, type MutationCtx } from "./_generated/server";
import { requireAdmin } from "./operatori";
import { action, type Action } from "./schema";

/**
 * Writes the one Registro row that names the action a person just took.
 *
 * Called from inside the mutation making the change, never scheduled and never
 * a mutation of its own, so that the change and the row it is recorded under
 * cannot exist without each other (ADR-0006). Hands back the row's id, which
 * every Movimento the same action produces carries (#16).
 */
export async function writeRegistroRow(
  ctx: MutationCtx,
  operatoreId: Id<"operatori">,
  action: Action,
): Promise<Id<"registro">> {
  return await ctx.db.insert("registro", { operatoreId, action });
}

/**
 * The Registro, newest first: who did what, as the structured fields the
 * screen turns into Italian sentences. Read by an Admin only.
 *
 * #27 builds that screen along with the filters — by day, by Cliente, by
 * Operatore — and #19 adds the Campagna. This is the plain read, the one the
 * fleet's own tests need to see a Censimento's row.
 */
export const list = query({
  args: {},
  returns: v.array(v.object({ operatore: v.string(), action })),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("registro").order("desc").collect();
    return await Promise.all(
      rows.map(async (row) => {
        const operatore = await ctx.db.get(row.operatoreId);
        if (operatore === null) {
          // Operatori are deactivated, never deleted (ADR-0004).
          throw new Error("A Registro row names an Operatore that is gone.");
        }
        return { operatore: operatore.nome, action: row.action };
      }),
    );
  },
});
