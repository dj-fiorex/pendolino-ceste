"use client";

import { useState } from "react";
import { NumeroField } from "@/components/numero-field";
import { Button } from "@/components/ui/button";
import type { MovimentoKind } from "@/convex/schema";
import { cesteCount, type FoundCesta } from "@/lib/ceste";
import { movimentoLabel } from "@/lib/movimento";

/**
 * The Ceste of one movement, added a numero at a time, each tile a tap away
 * from coming off again, and the one button that registers the lot.
 *
 * Below the Cliente a Ritiro and a Rientro are the same gesture — the Ceste are
 * counted onto the trailer or off it — so they are the same screen (#16, #17).
 */
export function CesteLoad({
  movimento,
  ceste,
  onChange,
  onConfirm,
}: {
  /** What is being registered, as the button and the warnings name it. */
  movimento: MovimentoKind;
  ceste: FoundCesta[];
  onChange: (ceste: FoundCesta[]) => void;
  onConfirm: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const name = movimentoLabel[movimento];

  const confirm = async () => {
    setPending(true);
    setFailed(false);
    try {
      await onConfirm();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <NumeroField
        label="Numero della Cesta"
        submitLabel="Aggiungi"
        onCesta={(cesta) => {
          // The same Cesta twice — typed after being scanned, say — is the one
          // Cesta she already was, and saying so is all that is left to do.
          if (ceste.some((added) => added._id === cesta._id)) {
            return `${cesta.codice} è già nell'elenco.`;
          }
          onChange([...ceste, cesta]);
          return null;
        }}
      />

      {ceste.length === 0 ? (
        <p className="text-muted-foreground">
          Scrivi il numero di ogni Cesta, una alla volta. Lo zero davanti non
          serve.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {ceste.map((cesta) => (
            <li key={cesta._id}>
              <button
                type="button"
                aria-label={`Togli la Cesta ${cesta.codice}`}
                onClick={() =>
                  onChange(ceste.filter((added) => added._id !== cesta._id))
                }
                className="flex h-24 w-full flex-col items-center justify-center rounded-lg border border-primary bg-secondary text-secondary-foreground transition-colors hover:bg-accent"
              >
                <span className="font-display text-lg font-bold tabular-nums">
                  {cesta.codice}
                </span>
                <span className="text-sm text-muted-foreground">
                  {cesta.portata} kg
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {failed && (
        <p role="alert" className="text-sm text-destructive">
          Non è stato possibile registrare il {name}. Controlla la connessione e
          riprova.
        </p>
      )}

      {ceste.length > 0 && (
        <div className="sticky bottom-4 rounded-xl border bg-card p-3 shadow-lg">
          <Button
            className="h-12 w-full text-base"
            disabled={pending}
            onClick={confirm}
          >
            {pending
              ? "Un attimo…"
              : `Conferma ${name} · ${cesteCount(ceste.length)}`}
          </Button>
        </div>
      )}
    </>
  );
}
