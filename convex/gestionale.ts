import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { readPhone } from "./phone";
import { comparableName, indexedNames, namesakeClash, properName } from "./schema";

/**
 * The one-way mirror's write side: what the Gestionale's own customer registry
 * becomes once it is in this app (ADR-0003).
 *
 * Called by `scripts/import-oleaplus.mjs`, which reads an export the mill
 * takes from OleaPlus by hand. The daemon the ADR describes is not built yet;
 * when it is, it arrives through this same door, because everything that makes
 * a second run safe is here rather than in the script: the Gestionale record's
 * own key decides whether a Cliente already exists, so importing the same
 * export twice inserts nobody twice.
 *
 * Nothing here ever writes back to the Gestionale, and nothing here edits a
 * Cliente the counter already has. An import only ever adds.
 */

/** What became of one row of the Gestionale's registry. */
const outcome = v.union(
  v.literal("imported"),
  // A Cliente already answers to this Gestionale record. The second import of
  // the same export is this, three thousand times over.
  v.literal("already_present"),
  // Nothing would tell this row apart from a Cliente already in the registry:
  // same name, and no Alias on either. Skipped rather than merged and rather
  // than inserted, because the app does not decide that two people are one,
  // and two rows nothing tells apart is how a Cesta reaches the wrong man
  // (CONTEXT.md). Handed back for the mill to name at the counter.
  v.literal("namesake"),
);

/**
 * The Gestionale's registry, in batches, as Clienti.
 *
 * Skips rather than throws. A registry of three thousand rows carries a
 * hundred things nobody can settle from a spreadsheet, and an import that dies
 * on the first of them is an import nobody finishes: every row is answered
 * for, and the ones this mutation would not decide come back to be decided by
 * the people who know the answer.
 */
export const importRegistry = internalMutation({
  args: {
    rows: v.array(
      v.object({
        // The Gestionale's own key for this record, `Codice` in the export.
        gestionaleId: v.string(),
        // Surname then forename, as the counter says a name out loud.
        name: v.string(),
        // As the Gestionale holds it, in whatever shape somebody typed it.
        phone: v.string(),
      }),
    ),
  },
  returns: v.array(
    v.object({
      gestionaleId: v.string(),
      name: v.string(),
      outcome,
      // Whether the Gestionale's telephone for this row was not a number
      // anybody could call — nearly always two numbers typed into one field.
      // Answered beside the outcome rather than folded into it, because it is
      // a fact about the OleaPlus record and not about what this run did with
      // it: the number is still wrong on the second import, when the Cliente
      // is already here and nothing is inserted, and the mill still has to be
      // told. A Cliente with no telephone is an ordinary Cliente (ADR-0009),
      // so this never stops the row going in.
      phoneUnreadable: v.boolean(),
    }),
  ),
  handler: async (ctx, args) => {
    const results = [];
    for (const row of args.rows) {
      // In the registry's own casing, not the Gestionale's. OleaPlus shouts —
      // CIPOLLA GIUSEPPE — and a couple of dozen rows in the export are typed
      // in lowercase besides; one rule over the lot is what makes the imported
      // registry read like the one the counter writes (ADR-0010).
      const name = properName(row.name);
      const reading = readPhone(row.phone);
      const said = {
        gestionaleId: row.gestionaleId,
        name,
        phoneUnreadable: reading.kind === "unreadable",
      };

      // Both reads are index lookups rather than a scan of the registry, and
      // both see what earlier rows of this same batch inserted: a Convex
      // mutation reads its own writes, so two rows of one batch are namesakes
      // of each other and not only of what was already there.
      const already = await ctx.db
        .query("clienti")
        .withIndex("by_gestionaleId", (q) =>
          q.eq("gestionaleId", row.gestionaleId),
        )
        .first();
      if (already !== null) {
        results.push({ ...said, outcome: "already_present" as const });
        continue;
      }

      // The import brings no Alias: a Soprannome is what the counter calls
      // somebody, and the Gestionale has never heard one. So a namesake here
      // is always the case with no Alias to tell the two apart.
      const namesakes = await ctx.db
        .query("clienti")
        .withIndex("by_comparableName", (q) =>
          q.eq("comparableName", comparableName(name)),
        )
        .collect();
      if (namesakeClash([], namesakes) !== null) {
        results.push({ ...said, outcome: "namesake" as const });
        continue;
      }

      const phone =
        reading.kind === "empty" || reading.kind === "unreadable"
          ? null
          : reading.e164;

      await ctx.db.insert("clienti", {
        name,
        alias: [],
        phone,
        gestionaleId: row.gestionaleId,
        active: true,
        ...indexedNames({ name, alias: [] }),
      });

      results.push({ ...said, outcome: "imported" as const });
    }

    // No Registro row, for any of it. The Registro says which Operatore did
    // what at the counter (ADR-0006), and nobody stood at a counter for this:
    // three thousand rows signed by an Admin who was asleep would be three
    // thousand lies in the one place the mill has to be able to trust.
    return results;
  },
});
