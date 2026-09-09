"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Etichetta } from "@/components/etichetta";
import { api } from "@/convex/_generated/api";
import type { EtichettaSize } from "@/convex/schema";
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
 * One of the two things the mill's own name and telephone amount to on a
 * label: whether it is printed, and what it would say.
 *
 * The value is shown and not edited. It belongs to the Frantoio and is typed
 * there (ADR-0011); what this screen decides is whether it goes on the label,
 * which is worth deciding with the label drawn beside you.
 *
 * A switch over a value nobody has written is disabled rather than left on
 * over nothing: `footerLines` drops an empty line silently, so an Admin who
 * left it on would print a blank foot and never be told why.
 */
function MillLine({
  id,
  label,
  switchLabel,
  value,
  on,
  onSwitch,
}: {
  id: string;
  label: string;
  switchLabel: string;
  value: string;
  on: boolean;
  onSwitch: (on: boolean) => void;
}) {
  const written = value.trim() !== "";
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <Switch
          id={id}
          aria-label={switchLabel}
          checked={written && on}
          disabled={!written}
          onCheckedChange={onSwitch}
        />
      </div>
      {written ? (
        <p className="text-sm text-muted-foreground">{value}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Non ancora scritto: si scrive in{" "}
          <Link
            href="/frantoio"
            className="underline underline-offset-4 hover:text-foreground"
          >
            «Il frantoio»
          </Link>
          .
        </p>
      )}
    </div>
  );
}

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
      await saveSettings({
        etichettaSize: settings.etichettaSize,
        millNameOnEtichetta: settings.millNameOnEtichetta,
        millPhoneOnEtichetta: settings.millPhoneOnEtichetta,
      });
    } catch {
      setError("Non è stato possibile salvare le impostazioni. Riprova.");
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

        <MillLine
          id="millName"
          label="Nome del frantoio"
          switchLabel="Stampa il nome del frantoio"
          value={settings.millName}
          on={settings.millNameOnEtichetta}
          onSwitch={(on) =>
            setSettings({ ...settings, millNameOnEtichetta: on })
          }
        />

        <MillLine
          id="millPhone"
          label="Telefono"
          switchLabel="Stampa il telefono"
          value={settings.millPhone}
          on={settings.millPhoneOnEtichetta}
          onSwitch={(on) =>
            setSettings({ ...settings, millPhoneOnEtichetta: on })
          }
        />

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
          Il formato e i due interruttori valgono per ogni stampa: si salvano
          quando scarichi il PDF, e ogni modifica finisce nel Registro. Il nome
          e il telefono si scrivono in{" "}
          <Link
            href="/frantoio"
            className="underline underline-offset-4 hover:text-foreground"
          >
            «Il frantoio»
          </Link>
          .
        </p>
      </aside>
    </div>
  );
}
