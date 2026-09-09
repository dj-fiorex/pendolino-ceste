import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireAdmin } from "./operatori";
import { writeRegistroRow } from "./registro";
import {
  etichettaChoiceFields,
  etichettaSettingsFields,
  type EtichettaChoice,
  type EtichettaSettings,
} from "./schema";
import { millSettings, saveMillSettings } from "./settings";

/**
 * What an Etichetta says, out of the one row the whole mill's settings share
 * with the Soglia di ritardo. Read through that row rather than off the table,
 * so that a setting nobody has ever touched answers the same way here as it
 * does wherever else it is read (#22).
 */
async function currentSettings(ctx: QueryCtx): Promise<EtichettaSettings> {
  // Named field by field rather than by taking everything the row is not: the
  // mill keeps its Soglia and its Sms in the same row, and a settling that
  // dropped only the ones it knew about would hand this query whatever the
  // next feature adds.
  const settings = await millSettings(ctx);
  return {
    etichettaSize: settings.etichettaSize,
    millName: settings.millName,
    millNameOnEtichetta: settings.millNameOnEtichetta,
    millPhone: settings.millPhone,
    millPhoneOnEtichetta: settings.millPhoneOnEtichetta,
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
 * Three things and not five. What the name and the telephone *say* is the
 * Frantoio's, settled on its own screen; what this one settles is whether they
 * are printed, which is a decision worth taking with the label drawn in front
 * of you (ADR-0011). A switch left on over a value nobody has written prints
 * nothing, so the screen disables it and says where to go.
 *
 * The Registro row names only what actually changed, with before and after
 * (ADR-0006); saving the same settings again changes nothing, and nothing
 * changed is nothing to record.
 */
export const setSettings = mutation({
  args: etichettaChoiceFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const wanted: EtichettaChoice = args;

    const before = await currentSettings(ctx);
    const changes = (
      ["etichettaSize", "millNameOnEtichetta", "millPhoneOnEtichetta"] as const
    )
      .filter((field) => before[field] !== wanted[field])
      .map((field) => ({
        field,
        before: before[field],
        after: wanted[field],
      }));
    if (changes.length === 0) {
      return null;
    }

    await saveMillSettings(ctx, wanted);
    await writeRegistroRow(ctx, {
      operatoreId: admin._id,
      action: { kind: "etichette_settings", changes },
    });
    return null;
  },
});
