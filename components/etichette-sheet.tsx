"use client";

import { useMutation } from "convex/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Etichetta } from "@/components/etichetta";
import { api } from "@/convex/_generated/api";
import { MAX_MILL_TEXT, type EtichettaSize } from "@/convex/schema";
import { ETICHETTA_SIZE_LABELS, type EtichettaSettings } from "@/lib/etichetta";
import { cn } from "@/lib/utils";

/** Just enough of a Cesta to put her on a label. */
export type EtichettaCesta = { numero: number; codice: string };

/**
 * Which Ceste are being printed: a run of numeri the Admin can widen or
 * narrow, or the rows ticked on the fleet screen.
 */
export type Selection =
  | { kind: "range"; from: string; to: string }
  | { kind: "numeri"; numeri: number[] };

/** How many labels the screen draws before it stops and counts the rest. */
const PREVIEW_MAX = 6;

const SIZES = Object.keys(ETICHETTA_SIZE_LABELS) as EtichettaSize[];

/** Every Cesta the mill owns: what an Admin who asked for no one in particular means. */
const wholeFleet = (ceste: EtichettaCesta[]): Selection => ({
  kind: "range",
  from: String(ceste[0]?.numero ?? ""),
  to: String(ceste[ceste.length - 1]?.numero ?? ""),
});

/**
 * The Etichette of a selection of Ceste: what they will look like, the
 * settings that decide it, and the PDF for the print shop. The PDF is built
 * here on the device and never stored — a torn label is reprinted by asking
 * for the same Cesta again, and the Codice that comes back is the one that was
 * printed the first time (ADR-0007).
 */
export function EtichetteSheet({
  ceste,
  initialSelection,
  initialSettings,
}: {
  ceste: EtichettaCesta[];
  /** The Ceste the Admin arrived for, or null for the whole fleet. */
  initialSelection: Selection | null;
  initialSettings: EtichettaSettings;
}) {
  const saveSettings = useMutation(api.etichette.setSettings);
  const [selection, setSelection] = useState(
    initialSelection ?? wholeFleet(ceste),
  );
  const [settings, setSettings] = useState(initialSettings);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => {
    if (selection.kind === "numeri") {
      const wanted = new Set(selection.numeri);
      return ceste.filter((cesta) => wanted.has(cesta.numero));
    }
    const from = Number(selection.from);
    const to = Number(selection.to);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from > to) {
      return [];
    }
    return ceste.filter((cesta) => cesta.numero >= from && cesta.numero <= to);
  }, [ceste, selection]);

  const changeRange = (edge: "from" | "to", value: string) =>
    setSelection((current) => {
      const range = current.kind === "range" ? current : wholeFleet(ceste);
      return { ...range, [edge]: value };
    });

  const onDownload = async () => {
    setBuilding(true);
    setError(null);
    try {
      // What is printed is what is recorded: the settings are saved before the
      // PDF is built, and the mutation writes its Registro row when they have
      // changed and nothing when they have not (ADR-0006).
      await saveSettings(settings);
    } catch {
      setError(
        "Non è stato possibile salvare le impostazioni. Il nome e il telefono devono starci sull'Etichetta: prova più corti.",
      );
      setBuilding(false);
      return;
    }
    try {
      // jsPDF only matters to whoever is actually printing, so it arrives with
      // the click rather than with the screen.
      const { etichettePdf, etichettePdfName } =
        await import("@/lib/etichette-pdf");
      const codici = selected.map((cesta) => cesta.codice);
      etichettePdf(codici, settings).save(etichettePdfName(codici));
    } catch {
      setError("Non è stato possibile preparare il PDF. Riprova.");
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_20rem] md:items-start">
      <div className="grid gap-4">
        <p className="text-muted-foreground">
          {selected.length === 0 ? (
            "Nessuna Cesta in questa scelta."
          ) : (
            <>
              {selected.length === 1
                ? `Cesta ${selected[0].codice}`
                : `Ceste da ${selected[0].codice} a ${selected[selected.length - 1].codice}`}{" "}
              ·{" "}
              {selected.length === 1
                ? "1 Etichetta"
                : `${selected.length} Etichette`}{" "}
              · una per pagina
            </>
          )}
        </p>
        {selected.length > 0 && (
          <div className="grid gap-4 rounded-xl bg-muted p-4 sm:grid-cols-2 lg:grid-cols-3">
            {selected.slice(0, PREVIEW_MAX).map((cesta) => (
              <div
                key={cesta.numero}
                className="justify-self-center shadow ring-1 ring-black/10"
              >
                <Etichetta
                  codice={cesta.codice}
                  settings={settings}
                  pxPerMm={1.5}
                />
              </div>
            ))}
            {selected.length > PREVIEW_MAX && (
              <p className="self-center text-sm text-muted-foreground">
                E altre {selected.length - PREVIEW_MAX} Etichette, tutte uguali
                a queste, nel PDF.
              </p>
            )}
          </div>
        )}
      </div>

      <aside className="grid gap-5 rounded-xl border bg-card p-4">
        <h2 className="font-medium">Impostazioni</h2>

        <div className="grid gap-2">
          <span className="text-sm text-muted-foreground">Quali Ceste</span>
          {selection.kind === "numeri" ? (
            <div className="grid gap-2">
              <p className="text-sm">
                {selection.numeri.length === 1
                  ? "1 Cesta segnata nella lista."
                  : `${selection.numeri.length} Ceste segnate nella lista.`}
              </p>
              <Button
                variant="outline"
                className="h-12 text-base"
                onClick={() => setSelection(wholeFleet(ceste))}
              >
                Scegli un intervallo
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                aria-label="Dal numero"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={selection.from}
                onChange={(event) => changeRange("from", event.target.value)}
                className="h-12 text-xl tabular-nums"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                aria-label="Al numero"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={selection.to}
                onChange={(event) => changeRange("to", event.target.value)}
                className="h-12 text-xl tabular-nums"
              />
            </div>
          )}
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-2 text-sm text-muted-foreground">
            Formato
          </legend>
          <div className="flex gap-2">
            {SIZES.map((size) => (
              <button
                key={size}
                type="button"
                aria-pressed={settings.etichettaSize === size}
                onClick={() =>
                  setSettings({ ...settings, etichettaSize: size })
                }
                className={cn(
                  "h-12 flex-1 rounded-lg border text-sm font-semibold transition-colors",
                  settings.etichettaSize === size
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-card hover:bg-accent",
                )}
              >
                {ETICHETTA_SIZE_LABELS[size]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="millName">Nome del frantoio</Label>
            <Switch
              aria-label="Stampa il nome del frantoio"
              checked={settings.millNameOnEtichetta}
              onCheckedChange={(on) =>
                setSettings({ ...settings, millNameOnEtichetta: on })
              }
            />
          </div>
          <Input
            id="millName"
            value={settings.millName}
            maxLength={MAX_MILL_TEXT}
            onChange={(event) =>
              setSettings({ ...settings, millName: event.target.value })
            }
            className="h-12 text-base"
          />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="millPhone">Telefono</Label>
            <Switch
              aria-label="Stampa il telefono"
              checked={settings.millPhoneOnEtichetta}
              onCheckedChange={(on) =>
                setSettings({ ...settings, millPhoneOnEtichetta: on })
              }
            />
          </div>
          <Input
            id="millPhone"
            type="tel"
            inputMode="tel"
            value={settings.millPhone}
            maxLength={MAX_MILL_TEXT}
            onChange={(event) =>
              setSettings({ ...settings, millPhone: event.target.value })
            }
            className="h-12 text-base tabular-nums"
          />
        </div>

        <Button
          disabled={building || selected.length === 0}
          onClick={onDownload}
          className="h-14 text-base"
        >
          {building
            ? "Un attimo…"
            : `Scarica PDF · ${selected.length === 1 ? "1 Etichetta" : `${selected.length} Etichette`}`}
        </Button>

        {error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Le impostazioni valgono per ogni stampa: si salvano quando scarichi il
          PDF, e ogni modifica finisce nel Registro.
        </p>
      </aside>
    </div>
  );
}
