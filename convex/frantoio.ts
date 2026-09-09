import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { requireAdmin } from "./operatori";
import { writeRegistroRow } from "./registro";
import {
  frantoioSettingsFields,
  MAX_MILL_TEXT,
  type FrantoioSettingField,
  type FrantoioSettings,
} from "./schema";
import { millSettings, saveMillSettings, type MillSettings } from "./settings";
import { smsSenderProblem } from "./template";

/**
 * The three of them, out of the one row the whole mill's settings share. Taken
 * from a row already read rather than reading it again: a setting nobody has
 * ever touched answers the same way here as it does wherever else it is read,
 * and `millSettings` is the one place that knows what unanswered answers.
 */
const frantoioOf = (settings: MillSettings): FrantoioSettings => ({
  millName: settings.millName,
  millPhone: settings.millPhone,
  smsSender: settings.smsSender,
});

/**
 * The Frantoio as it stands: the name and the telephone a Cliente reads, the
 * Mittente its Sms arrive from, and the Soglia di ritardo.
 *
 * The Soglia rides along rather than being fetched separately, because the
 * screen shows all four at once and the Sms screen wants the first three: one
 * query is one round trip on a telephone with one bar of signal.
 *
 * Admin only, like the screen that edits it.
 */
export const settings = query({
  args: {},
  returns: v.object({ ...frantoioSettingsFields, sogliaRitardo: v.number() }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const settings = await millSettings(ctx);
    return { ...frantoioOf(settings), sogliaRitardo: settings.sogliaRitardo };
  },
});

/**
 * An Admin settles what the frantoio is called, what its telephone is, and who
 * its Sms come from. One row for the whole mill, so this overwrites rather
 * than adds.
 *
 * The telephone is taken as typed and not read into E.164, because this one is
 * never dialled by the app: it is printed across the foot of an Etichetta and
 * written into an Sms, where «0931 000 000» reads better than what a carrier
 * would want. The screen warns about a number it cannot make sense of; this
 * mutation does not refuse it, because the mill knows its own telephone better
 * than the app's rule for Italian numbering does (ADR-0009 governs a Cliente's
 * telephone, which is dialled, and this is not that).
 *
 * The Mittente is refused, and that is not the same inconsistency: a name the
 * carrier will not take is not a number somebody can still read past, it is a
 * message that never arrives.
 *
 * The Registro row names only what actually changed, with before and after
 * (ADR-0006); saving the same settings again changes nothing, and nothing
 * changed is nothing to record.
 */
export const setSettings = mutation({
  args: frantoioSettingsFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const wanted: FrantoioSettings = {
      millName: args.millName.trim(),
      millPhone: args.millPhone.trim(),
      smsSender: args.smsSender.trim(),
    };

    for (const text of [wanted.millName, wanted.millPhone]) {
      if (text.length > MAX_MILL_TEXT) {
        throw new Error(
          `The mill's name and telephone fit ${MAX_MILL_TEXT} characters on an Etichetta.`,
        );
      }
    }
    const problem = smsSenderProblem(wanted.smsSender);
    if (problem !== null) {
      throw new Error(problem);
    }

    const before = frantoioOf(await millSettings(ctx));
    const changes = (["millName", "millPhone", "smsSender"] as const)
      .filter((field) => before[field] !== wanted[field])
      .map((field) => ({
        field: field as FrantoioSettingField,
        before: before[field],
        after: wanted[field],
      }));
    if (changes.length === 0) {
      return null;
    }

    await saveMillSettings(ctx, wanted);
    await writeRegistroRow(ctx, {
      operatoreId: admin._id,
      action: { kind: "frantoio_settings", changes },
    });
    return null;
  },
});

/**
 * An Admin settles how many days a Cesta may be Fuori before the Lista di
 * recupero calls her In ritardo. One value for the whole mill (CONTEXT.md).
 *
 * It moves no Cesta and takes nobody off the list: all it decides is which
 * rows are highlighted. That is also why it is settled here and not on the
 * list it colours — the Lista is the same list in the same order at one day
 * and at a hundred, so there is nothing to watch while you change it, and a
 * setting you can only state belongs to the Frantoio (ADR-0011).
 *
 * Its own mutation and its own card, sharing the `frantoio_settings` Registro
 * kind with the three strings beside it: one number with one rule does not fit
 * comfortably into a save that trims text.
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
      action: {
        kind: "frantoio_settings",
        changes: [
          { field: "sogliaRitardo", before, after: args.days },
        ],
      },
    });
    return null;
  },
});
