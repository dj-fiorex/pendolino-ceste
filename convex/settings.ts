import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  DEFAULT_SOGLIA_RITARDO,
  type EtichettaSettings,
  type FrantoioSettings,
  type SmsSettings,
  type StoredSettings,
} from "./schema";
import { DEFAULT_SMS_RIENTRO, DEFAULT_SMS_RITIRO } from "./template";

/**
 * Everything the mill has settled on, as the app answers for it: never a
 * missing field and never a missing row, so that no screen and no mutation has
 * to know whether an Admin has been here before. The stored row is the other
 * shape — there, a setting nobody has touched is simply absent.
 */
export type MillSettings = EtichettaSettings &
  FrantoioSettings &
  SmsSettings & { sogliaRitardo: number };

/**
 * What the row says when nobody has decided otherwise: the label size the mill
 * assumed while the screens were drawn, and no name and no telephone, because
 * the app cannot know them. The switches start on, so that typing the name on
 * Il frantoio is enough to see it on the label.
 *
 * These five are the columns the row cannot be without, so these are the
 * values a row is created with. The Mittente is not among them: it arrived after the row did,
 * and answers empty until an Admin settles it (ADR-0004).
 */
const ROW_DEFAULTS: EtichettaSettings = {
  etichettaSize: "100x150",
  millName: "",
  millNameOnEtichetta: true,
  millPhone: "",
  millPhoneOnEtichetta: true,
};

/**
 * The Mittente an Sms arrives from before the mill has said. Empty, and
 * deliberately not a guess: "Frantoio" landing on two hundred telephones is
 * worse than nothing landing, because nobody notices it is wrong. Empty is
 * what holds both switches shut until somebody types the real one.
 */
const DEFAULT_SMS_SENDER = "";

/**
 * What the mill's Sms say, and whether they are sent at all, when nobody has
 * decided otherwise: the app's own words, and both switches off.
 *
 * Off, because the first thing a mill does with a new feature is try it, and
 * the second thing it would do is discover it had texted two hundred farmers
 * while trying. An Admin turns each one on when the words are right.
 */
const DEFAULT_SMS_SETTINGS: SmsSettings = {
  smsRitiroTemplate: DEFAULT_SMS_RITIRO,
  smsRitiroOn: false,
  smsRientroTemplate: DEFAULT_SMS_RIENTRO,
  smsRientroOn: false,
};

/**
 * The settings as they stand, whether or not anybody has ever set them, and
 * whether or not the one row predates the setting being asked for. The
 * Etichetta and the Soglia di ritardo share it, so this is the one place that
 * knows what an unanswered setting answers.
 */
export async function millSettings(ctx: QueryCtx): Promise<MillSettings> {
  const stored = await ctx.db.query("settings").first();
  if (stored === null) {
    return {
      ...ROW_DEFAULTS,
      ...DEFAULT_SMS_SETTINGS,
      smsSender: DEFAULT_SMS_SENDER,
      sogliaRitardo: DEFAULT_SOGLIA_RITARDO,
    };
  }
  return {
    etichettaSize: stored.etichettaSize,
    millName: stored.millName,
    millNameOnEtichetta: stored.millNameOnEtichetta,
    millPhone: stored.millPhone,
    millPhoneOnEtichetta: stored.millPhoneOnEtichetta,
    smsSender: stored.smsSender ?? DEFAULT_SMS_SENDER,
    sogliaRitardo: stored.sogliaRitardo ?? DEFAULT_SOGLIA_RITARDO,
    smsRitiroTemplate:
      stored.smsRitiroTemplate ?? DEFAULT_SMS_SETTINGS.smsRitiroTemplate,
    smsRitiroOn: stored.smsRitiroOn ?? DEFAULT_SMS_SETTINGS.smsRitiroOn,
    smsRientroTemplate:
      stored.smsRientroTemplate ?? DEFAULT_SMS_SETTINGS.smsRientroTemplate,
    smsRientroOn: stored.smsRientroOn ?? DEFAULT_SMS_SETTINGS.smsRientroOn,
  };
}

/**
 * Settles some of the settings and leaves the rest as they were. One row for
 * the whole mill, so this overwrites rather than adds, and a mill that has
 * never set anything gets the row it never had.
 *
 * Only what the caller named is written. A first Etichetta save does not
 * quietly settle the Soglia di ritardo at ten as well: a setting nobody has
 * chosen stays unchosen in the row, and answers as the app's own until an
 * Admin says otherwise (ADR-0004).
 *
 * The Registro row is the caller's, not this function's: only the mutation
 * knows which of its own fields actually changed, and nothing changed is
 * nothing to record (ADR-0006).
 */
export async function saveMillSettings(
  ctx: MutationCtx,
  wanted: Partial<StoredSettings>,
): Promise<void> {
  const stored = await ctx.db.query("settings").first();
  if (stored === null) {
    await ctx.db.insert("settings", {
      ...ROW_DEFAULTS,
      ...wanted,
    });
    return;
  }
  await ctx.db.patch(stored._id, wanted);
}
