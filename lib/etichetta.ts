import type { EtichettaSettings, EtichettaSize } from "@/convex/schema";

export type { EtichettaSettings } from "@/convex/schema";

/**
 * One Etichetta, in millimetres, from the paper down to the type. Both the
 * preview on screen and the PDF the print shop prints take their measurements
 * from here: the preview stacks them with flexbox and the PDF places them by
 * hand, so it is these numbers, and not the two layouts, that agree.
 *
 * The QR is never smaller than 40 mm, whatever the size of the label: it is
 * read off a Cesta in a yard, by a phone held at arm's length (ADR-0007).
 */
export type EtichettaLayout = {
  width: number;
  height: number;
  padding: number;
  /** The `<portata>-<forma>` prefix, in smaller type above the numero. */
  prefixFont: number;
  numeroFont: number;
  qr: number;
  footerFont: number;
  footerLine: number;
};

export const ETICHETTA_LAYOUTS: Record<EtichettaSize, EtichettaLayout> = {
  "100x150": {
    width: 100,
    height: 150,
    padding: 7,
    prefixFont: 11,
    numeroFont: 34,
    qr: 52,
    footerFont: 4.5,
    footerLine: 5.5,
  },
  a6: {
    width: 105,
    height: 148,
    padding: 7,
    prefixFont: 11,
    numeroFont: 34,
    qr: 52,
    footerFont: 4.5,
    footerLine: 5.5,
  },
  "70x100": {
    width: 70,
    height: 100,
    padding: 5,
    prefixFont: 8,
    numeroFont: 24,
    qr: 44,
    footerFont: 3.5,
    footerLine: 4.5,
  },
};

/** How each size is offered to the Admin. */
export const ETICHETTA_SIZE_LABELS: Record<EtichettaSize, string> = {
  "100x150": "100 × 150",
  "70x100": "70 × 100",
  a6: "A6",
};

/**
 * What runs across the foot of the label: the mill's name and its telephone,
 * each one there when the Admin has both switched it on and written it down.
 */
export const footerLines = (settings: EtichettaSettings) =>
  [
    settings.millNameOnEtichetta ? settings.millName.trim() : "",
    settings.millPhoneOnEtichetta ? settings.millPhone.trim() : "",
  ].filter((line) => line !== "");

/** A Codice split for the label: `400-R-017` is `400-R` above and `017` below. */
export const etichettaText = (codice: string) => {
  const [portata, forma, numero] = codice.split("-");
  return { prefix: `${portata}-${forma}`, numero };
};
