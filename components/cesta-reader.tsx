"use client";

import { NumeroKeypadDialog } from "@/components/numero-keypad-dialog";
import { Scanner } from "@/components/scanner";
import type { FoundCesta } from "@/lib/ceste";

/**
 * The two ways a Cesta is read at the counter, on screen together: the camera
 * reading the QR off her Etichetta, and a button opening the shared numero
 * keypad. Manual entry never focuses an input or opens the device keyboard.
 *
 * They are one component because they are one act. The QR carries the Cesta's
 * Codice, the keypad takes her bare numero, and `ceste.byCodice` and
 * `ceste.byNumero` answer with the same Cesta in the same shape (ADR-0007), so
 * the flow says what it makes of her once, here, for both.
 */
export function CestaReader({
  label,
  submitLabel,
  codici,
  onCesta,
}: {
  /** What the keypad asks for, in the words of the screen asking. */
  label: string;
  submitLabel: string;
  /** The Codici already in this movement: the camera does not offer them again. */
  codici: string[];
  onCesta: (cesta: FoundCesta) => string | null;
}) {
  return (
    <>
      <Scanner codici={codici} onCesta={onCesta} />
      <NumeroKeypadDialog
        title={label}
        description="Digita il numero della Cesta. Lo zero davanti non serve."
        submitLabel={submitLabel}
        onCesta={onCesta}
      />
    </>
  );
}
