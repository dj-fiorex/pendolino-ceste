"use client"
// PROTOTYPE (#31) — Ritiro variant B "Tessere, scanner in basso". The running
// list is the screen, as 96 px tiles like the Svuotamento; the scanner is a
// thumbnail docked at the bottom beside the numero field; the warning is a
// one-line strip with the Codici as chips.

import * as React from "react"
import { TriangleAlertIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScannerDock } from "@/components/prototype/screens/scanner-dock"
import { Tile } from "@/components/prototype/tile"
import { useRitiro } from "@/components/prototype/screens/use-ritiro"
import { cesteLabel } from "@/lib/use-svuotamento"
import { buildFleet, codiceOf } from "@/lib/prototype-data"
import { formatGiorno } from "@/lib/prototype-fuori"

export function RitiroB() {
  const r = useRitiro()
  const fleet = React.useMemo(() => buildFleet(), [])

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-4 p-3 pb-44 md:p-4">
      <header className="flex items-center gap-2">
        <h1 className="font-heading text-lg font-medium">Ritiro</h1>
        <span className="text-muted-foreground">·</span>
        <span className="truncate text-lg font-medium">{r.cliente.nome}</span>
        {r.cliente.alias.map((a) => (
          <Badge key={a} variant="secondary">
            {a}
          </Badge>
        ))}
        <Button variant="ghost" className="ml-auto h-10 shrink-0">
          Cambia
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50">
        <TriangleAlertIcon className="size-4 text-amber-700 dark:text-amber-300" />
        <span className="font-medium">
          Ha già {cesteLabel(r.prestito.numeri.length)} Fuori dal{" "}
          {formatGiorno(r.prestito.ritiroAt)}:
        </span>
        {r.prestito.numeri.map((n) => (
          <Badge
            key={n}
            variant="outline"
            className="border-amber-400 bg-background font-mono tabular-nums dark:border-amber-600"
          >
            {codiceOf(n)}
          </Badge>
        ))}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="flex items-baseline justify-between text-sm text-muted-foreground">
          <span>Questo Ritiro · tocca una tessera per toglierla</span>
          <span>{cesteLabel(r.lista.length)}</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {r.lista.map((n) => (
            <Tile
              key={n}
              cesta={fleet[n - 1]}
              size={96}
              selected
              onToggle={() => r.remove(n)}
            />
          ))}
        </div>
        {r.lista.length === 0 && (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Scansiona la prima Cesta o scrivi il numero qui sotto.
          </p>
        )}
      </section>

      <ScannerDock
        ultimo={r.ultimo ? codiceOf(r.ultimo) : undefined}
        onAdd={r.add}
        label={`Conferma Ritiro · ${cesteLabel(r.lista.length)}`}
        disabled={r.lista.length === 0}
        onConfirm={r.confirm}
      />
    </div>
  )
}
