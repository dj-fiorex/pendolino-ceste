"use client"
// PROTOTYPE (#31) — Etichette variant B "Foglio e impostazioni". The PDF as
// the tipografia sees it — the range just entered, one page each, laid out
// as a sheet — with the Admin settings of #29 beside it: range, size, the
// mill's name and phone on or off.

import * as React from "react"
import { DownloadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { Etichetta } from "@/components/prototype/screens/etichetta"
import { codiceOf } from "@/lib/prototype-data"

const RANGE = [17, 18, 19, 20, 21, 22]
const SELEZIONATA = 17

export function EtichettaB() {
  const [nome, setNome] = React.useState(true)
  const [telefono, setTelefono] = React.useState(true)
  const [formato, setFormato] = React.useState("100x150")

  return (
    <div className="flex min-h-svh flex-col gap-4 p-3 md:p-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Etichette</h1>
        <p className="text-sm text-muted-foreground">
          Ceste da{" "}
          <span className="font-mono text-foreground tabular-nums">
            {codiceOf(RANGE[0])}
          </span>{" "}
          a{" "}
          <span className="font-mono text-foreground tabular-nums">
            {codiceOf(RANGE.at(-1)!)}
          </span>{" "}
          · {RANGE.length} Etichette · una per pagina
        </p>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="rounded-xl bg-muted p-3 md:p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {RANGE.map((n) => (
              <div
                key={n}
                className={cn(
                  "justify-self-center shadow ring-1 ring-black/10",
                  n === SELEZIONATA && "ring-2 ring-foreground"
                )}
              >
                <Etichetta
                  codice={codiceOf(n)}
                  pxPerMm={1.5}
                  nome={nome}
                  telefono={telefono}
                />
              </div>
            ))}
          </div>
        </div>

        <aside className="flex flex-col gap-5 rounded-xl border bg-card p-4">
          <h2 className="font-medium">Impostazioni</h2>

          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">Intervallo</span>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value="017"
                aria-label="Dal numero"
                className="h-12 w-0 min-w-0 flex-1 rounded-lg border bg-background px-3 font-mono text-xl tabular-nums"
              />
              <span className="text-muted-foreground">–</span>
              <input
                readOnly
                value="022"
                aria-label="Al numero"
                className="h-12 w-0 min-w-0 flex-1 rounded-lg border bg-background px-3 font-mono text-xl tabular-nums"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">Formato</span>
            <ToggleGroup
              value={[formato]}
              onValueChange={(v) => v[0] && setFormato(String(v[0]))}
              variant="outline"
              className="w-full"
            >
              <ToggleGroupItem value="100x150" className="h-11 flex-1">
                100 × 150
              </ToggleGroupItem>
              <ToggleGroupItem value="70x100" className="h-11 flex-1">
                70 × 100
              </ToggleGroupItem>
              <ToggleGroupItem value="a6" className="h-11 flex-1">
                A6
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <label className="flex h-12 items-center justify-between gap-3">
            <span>Nome del frantoio</span>
            <Switch checked={nome} onCheckedChange={setNome} />
          </label>
          <label className="flex h-12 items-center justify-between gap-3">
            <span>Telefono</span>
            <Switch checked={telefono} onCheckedChange={setTelefono} />
          </label>

          <Button className="h-14 text-base">
            <DownloadIcon data-icon="inline-start" />
            Scarica PDF · {RANGE.length} Etichette
          </Button>
          <p className="text-xs text-muted-foreground">
            Le impostazioni valgono per ogni stampa; ogni modifica finisce nel
            Registro.
          </p>
        </aside>
      </div>
    </div>
  )
}
