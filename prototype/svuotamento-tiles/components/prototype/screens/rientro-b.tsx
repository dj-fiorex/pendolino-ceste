"use client"
// PROTOTYPE (#31) — Rientro variant B "Tessere, scanner in basso". The
// Cliente's Ceste Fuori as 96 px tiles, ticked ones filled exactly like a
// selected Svuotamento tile; scanner and numero field docked at the bottom.

import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { ScannerDock } from "@/components/prototype/screens/scanner-dock"
import { SCANSIONATA, useRientro } from "@/components/prototype/screens/use-rientro"
import { Tile } from "@/components/prototype/tile"
import { cesteLabel } from "@/lib/use-svuotamento"
import { buildFleet, codiceOf } from "@/lib/prototype-data"
import { formatGiorno, giorniFuori, giorniLabel } from "@/lib/prototype-fuori"

export function RientroB() {
  const r = useRientro()
  const fleet = React.useMemo(() => buildFleet(), [])

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-4 p-3 pb-44 md:p-4">
      <h1 className="font-heading text-lg font-medium">Rientro</h1>

      <header className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3">
        <h2 className="flex flex-wrap items-center gap-x-2 text-xl font-medium">
          Ceste di {r.cliente.nome}
          <span className="text-muted-foreground">·</span>
          <span>{r.cliente.alias[0]}</span>
        </h2>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          {cesteLabel(r.prestito.numeri.length)} Fuori dal{" "}
          {formatGiorno(r.prestito.ritiroAt)} ·{" "}
          {giorniLabel(giorniFuori(r.prestito.ritiroAt))}
          <Badge variant="secondary" className="font-mono tabular-nums">
            scansionata {codiceOf(SCANSIONATA)}
          </Badge>
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="flex items-baseline justify-between text-sm text-muted-foreground">
          <span>Sul rimorchio · tocca per spuntare</span>
          <span>{cesteLabel(r.spuntate.size)}</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {[...r.prestito.numeri, ...r.rettifiche].map((n) => (
            <Tile
              key={n}
              cesta={fleet[n - 1]}
              size={96}
              selected={r.spuntate.has(n)}
              onToggle={() => r.toggle(n)}
            />
          ))}
        </div>
      </section>

      {r.restano.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50">
          <span className="font-medium">
            {r.restano.length === 1 ? "Resta" : "Restano"} Fuori con {r.cliente.nome}:
          </span>
          {r.restano.map((n) => (
            <Badge
              key={n}
              variant="outline"
              className="border-amber-400 bg-background font-mono tabular-nums dark:border-amber-600"
            >
              {codiceOf(n)}
            </Badge>
          ))}
        </div>
      )}

      <ScannerDock
        ultimo={codiceOf(SCANSIONATA)}
        onAdd={r.addByNumero}
        label={`Registra Rientro · ${cesteLabel(r.spuntate.size)}`}
        disabled={r.spuntate.size === 0}
        onConfirm={r.confirm}
      />
    </div>
  )
}
