import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { indexedNames, properName } from "./schema";

/**
 * The one-off rewrite that puts the registry already in the database on the
 * rules the rest of the app now writes by (ADR-0010): the name in the
 * registry's own casing, and the two derived fields the `clienti` indexes are
 * built on.
 *
 *   npx convex run backfill:clienti '{ "cursor": null }'
 *
 * Run it straight after the deploy that adds the indexes. Between the two, a
 * Cliente the backfill has not reached yet carries no `searchableNames` and so
 * cannot be found by the box at the counter — which is a good reason to do the
 * two together and a bad reason to do either during a queue.
 *
 * It writes no Registro rows, for the reason the import writes none (ADR-0006):
 * the Registro says which Operatore did what at the counter, and nobody stood
 * at a counter for this.
 *
 * It is safe to run twice, and safe to stop halfway and start again: a page
 * whose rows already say what they should is a page it patches nothing on.
 * Re-casing a name moves nobody in or out of anybody else's namesakes, because
 * `comparableName` is blind to case — so the namesake invariant holds
 * throughout, without this mutation having to check it.
 */

/**
 * How many Clienti one transaction rewrites. Small enough to stay well inside
 * a mutation's limits on a table of a few thousand, and the next page is
 * scheduled rather than looped, so the size that matters is this one and not
 * the registry's.
 */
const PAGE = 200;

export const clienti = internalMutation({
  args: { cursor: v.union(v.null(), v.string()) },
  returns: v.object({
    read: v.number(),
    rewritten: v.number(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("clienti")
      .paginate({ cursor: args.cursor, numItems: PAGE });

    let rewritten = 0;
    for (const cliente of page.page) {
      const wanted = {
        name: properName(cliente.name),
        ...indexedNames({ name: properName(cliente.name), alias: cliente.alias }),
      };
      if (
        cliente.name === wanted.name &&
        cliente.comparableName === wanted.comparableName &&
        cliente.searchableNames === wanted.searchableNames
      ) {
        continue;
      }
      await ctx.db.patch(cliente._id, wanted);
      rewritten++;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.backfill.clienti, {
        cursor: page.continueCursor,
      });
    }
    return { read: page.page.length, rewritten, isDone: page.isDone };
  },
});
