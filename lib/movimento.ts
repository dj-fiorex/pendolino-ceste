import type { MovimentoKind, Rettifica, RettificaCause } from "@/convex/schema";
import { stateLabel } from "@/lib/ceste";

/**
 * What each Movimento is called, wherever a screen names one. The mill's own
 * words, so the button, the tile and the Cliente's history all say what the
 * counter says.
 */
export const movimentoLabel: Record<MovimentoKind, string> = {
  ritiro: "Ritiro",
  rientro: "Rientro",
  svuotamento: "Svuotamento",
  rettifica: "Rettifica",
};

/**
 * What each cause of a Rettifica is called on screen: the three an Admin
 * chooses between, and the one the app writes itself as a Movimento goes
 * through on a Cesta that was not where it believed (ADR-0005).
 */
export const rettificaCauseLabel: Record<RettificaCause, string> = {
  persa: "Persa",
  rotta: "Rotta",
  ritrovata: "Ritrovata",
  discrepanza: "Discrepanza",
};

/**
 * One Rettifica as a Cesta's own history reads her: why she was written, where
 * the app had the Cesta and where the correction left her — the pair the whole
 * project exists to show (ADR-0005).
 *
 * A correction that moved nothing says so rather than reading "da Dismessa a
 * Dismessa": a Cesta emptied while written off turns up without coming back
 * into the fleet (#20).
 */
export const rettificaLine = (rettifica: Rettifica) =>
  rettifica.believedState === rettifica.becomes
    ? `${rettificaCauseLabel[rettifica.cause]} · resta ${stateLabel[rettifica.becomes]}`
    : `${rettificaCauseLabel[rettifica.cause]} · da ${stateLabel[rettifica.believedState]} a ${stateLabel[rettifica.becomes]}`;
