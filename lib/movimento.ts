import type { MovimentoKind } from "@/convex/schema";

/**
 * What each Movimento is called, wherever a screen names one. The mill's own
 * words, so the button, the tile and the Cliente's history all say what the
 * counter says.
 */
export const movimentoLabel: Record<MovimentoKind, string> = {
  ritiro: "Ritiro",
  rientro: "Rientro",
};
