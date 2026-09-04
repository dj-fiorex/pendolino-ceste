import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  DEFAULT_SOGLIA_RITARDO,
  type EtichettaSettings,
  type MillSettings,
} from "./schema";

/**
 * Everything the mill has settled on, as the app answers for it: never a
 * missing field and never a missing row, so that no screen and no mutation has
 * to know whether an Admin has been here before.
 */
export type SettledSettings = EtichettaSettings & { sogliaRitardo: number };

/**
 * What the mill runs on before anybody decides otherwise: the Etichetta size
 * the screens were drawn at, no mill name or telephone — the app cannot know
 * them — and the Soglia di ritardo of ten days. The switches start on, so that
 * typing the name is enough to see it on the label.
 */
const DEFAULT_SETTINGS: SettledSettings = {
  etichettaSize: "100x150",
  millName: "",
  millNameOnEtichetta: true,
  millPhone: "",
  millPhoneOnEtichetta: true,
  sogliaRitardo: DEFAULT_SOGLIA_RITARDO,
};

/**
 * The settings as they stand, whether or not anybody has ever set them, and
 * whether or not the one row predates the setting being asked for. The
 * Etichetta and the Soglia di ritardo share it, so this is the one place that
 * knows what an unanswered setting answers.
 */
export async function millSettings(ctx: QueryCtx): Promise<SettledSettings> {
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
    sogliaRitardo: stored.sogliaRitardo ?? DEFAULT_SETTINGS.sogliaRitardo,
  };
}

/**
 * Settles some of the settings and leaves the rest as they were. One row for
 * the whole mill, so this overwrites rather than adds, and a mill that has
 * never set anything gets the row it never had with the app's own values in
 * every field nobody named.
 *
 * The Registro row is the caller's, not this function's: only the mutation
 * knows which of its own fields actually changed, and nothing changed is
 * nothing to record (ADR-0006).
 */
export async function saveMillSettings(
  ctx: MutationCtx,
  wanted: Partial<MillSettings>,
): Promise<void> {
  const stored = await ctx.db.query("settings").first();
  if (stored === null) {
    await ctx.db.insert("settings", { ...DEFAULT_SETTINGS, ...wanted });
    return;
  }
  await ctx.db.patch(stored._id, wanted);
}
