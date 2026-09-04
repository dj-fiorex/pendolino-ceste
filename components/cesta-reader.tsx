"use client";

import { NumeroField } from "@/components/numero-field";
import { Scanner } from "@/components/scanner";
import type { FoundCesta } from "@/lib/ceste";

/**
 * The two ways a Cesta is read at the counter, on screen together: the camera
 * reading the QR off her Etichetta, and her numero typed. Both are always
 * there, and neither is behind a switch — a label on a stacked Cesta can be on
 * the face nobody can see, and a yard in November is not clean (#23).
 *
 * They are one component because they are one act. The QR carries the Cesta's
 * Codice, the field takes her bare numero, and `ceste.byCodice` and
 * `ceste.byNumero` answer with the same Cesta in the same shape (ADR-0007), so
 * the flow says what it makes of her once, here, for both.
 */
export function CestaReader({
  label,
  submitLabel,
  codici,
  onCesta,
}: {
  /** What the numero field asks for, in the words of the screen asking. */
  label: string;
  submitLabel: string;
  /** The Codici already in this movement: the camera does not offer them again. */
  codici: string[];
  onCesta: (cesta: FoundCesta) => string | null;
}) {
  return (
    <>
      <Scanner codici={codici} onCesta={onCesta} />
      <NumeroField label={label} submitLabel={submitLabel} onCesta={onCesta} />
    </>
  );
}
