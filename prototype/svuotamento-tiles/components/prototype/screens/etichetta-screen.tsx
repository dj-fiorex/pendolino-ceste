"use client"
// PROTOTYPE (#31) — the Etichette PDF preview screen (#29, Admin): one label
// selected, shown as the page the tipografia will get.

import { DownloadIcon, PrinterIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Etichetta, ETICHETTA_MM } from "@/components/prototype/screens/etichetta"

export const CODICE_ETICHETTA = "400-R-017"

export function EtichettaScreen() {
  return (
    <div className="flex min-h-svh flex-col gap-4 p-3 md:p-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex flex-1 flex-col gap-1">
          <h1 className="font-heading text-lg font-medium">Etichette</h1>
          <p className="text-sm text-muted-foreground">
            Anteprima di stampa · 1 Etichetta · {ETICHETTA_MM.width} ×{" "}
            {ETICHETTA_MM.height} mm · Cesta{" "}
            <span className="font-mono text-foreground tabular-nums">
              {CODICE_ETICHETTA}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="h-12 px-4 text-base">
            <PrinterIcon data-icon="inline-start" />
            Stampa
          </Button>
          <Button className="h-12 px-4 text-base">
            <DownloadIcon data-icon="inline-start" />
            Scarica PDF
          </Button>
        </div>
      </header>

      <div className="flex flex-1 items-start justify-center rounded-xl bg-muted p-4 md:p-6">
        <div className="shadow-xl ring-1 ring-black/10">
          <div className="hidden md:block">
            <Etichetta codice={CODICE_ETICHETTA} pxPerMm={4.2} />
          </div>
          <div className="md:hidden">
            <Etichetta codice={CODICE_ETICHETTA} pxPerMm={3.3} />
          </div>
        </div>
      </div>
    </div>
  )
}
