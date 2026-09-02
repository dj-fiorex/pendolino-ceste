import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireAdmin } from "./operatori";
import { writeRegistroRow } from "./registro";
import {
  etichettaSettingField,
  etichettaSettingsFields,
  MAX_MILL_TEXT,
  type EtichettaSettingField,
} from "./schema";

/**
 * What an Etichetta says when nobody has decided otherwise: the size the mill
 * assumed while the screens were drawn, and no mill name or telephone, because
 * the app cannot know them. The switches start on, so that typing the name is
 * enough to see it on the label.
 */
const DEFAULT_SETTINGS = {
  etichettaSize: "100x150",
  millName: "",
  millNameOnEtichetta: true,
  millPhone: "",
  millPhoneOnEtichetta: true,
} as const;

/** The settings as they stand, whether or not anybody has ever set them. */
async function currentSettings(ctx: QueryCtx) {
  const stored = await ctx.db.query("settings").first();
  if (stored === null) {
    return { ...DEFAULT_SETTINGS };
  }
  return {
    etichettaSize: stored.etichettaSize,
    millName: stored.millName,
    millNameOnEtichetta: stored.millNameOnEtichetta,
    millPhone: stored.millPhone,
    millPhoneOnEtichetta: stored.millPhoneOnEtichetta,
  };
}

/**
 * What every Etichetta printed from now on will look like. Admin only, like
 * the screen that prints them (spec #1).
 */
export const settings = query({
  args: {},
  returns: v.object(etichettaSettingsFields),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await currentSettings(ctx);
  },
});

/**
 * An Admin settles the Etichetta: its size, and whether the mill's name and
 * telephone are printed on it. One row for the whole mill, so this overwrites
 * rather than adds. The screen calls it as it builds a PDF, so that no label
 * is ever printed from settings the Registro has not seen.
 *
 * The Registro row names only what actually changed, with before and after
 * (ADR-0006, #27); saving the same settings again changes nothing, and nothing
 * changed is nothing to record.
 */
export const setSettings = mutation({
  args: etichettaSettingsFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const wanted = {
      ...args,
      millName: args.millName.trim(),
      millPhone: args.millPhone.trim(),
    };
    for (const text of [wanted.millName, wanted.millPhone]) {
      if (text.length > MAX_MILL_TEXT) {
        throw new Error(
          `The mill's name and telephone fit ${MAX_MILL_TEXT} characters on an Etichetta.`,
        );
      }
    }

    const before = await currentSettings(ctx);
    const changes = etichettaSettingField.members
      .map((member) => member.value as EtichettaSettingField)
      .filter((field) => before[field] !== wanted[field])
      .map((field) => ({
        field,
        before: before[field],
        after: wanted[field],
      }));
    if (changes.length === 0) {
      return null;
    }

    const stored = await ctx.db.query("settings").first();
    if (stored === null) {
      await ctx.db.insert("settings", wanted);
    } else {
      await ctx.db.patch(stored._id, wanted);
    }
    await writeRegistroRow(ctx, admin._id, {
      kind: "etichette_settings",
      changes,
    });
    return null;
  },
});
