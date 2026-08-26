"use client"
// PROTOTYPE (#31) — Rientro variant C "Rientrano / Restano". Camera across
// the top with the Cliente laid over it; below, two lists the Operatore
// moves Ceste between with a tap: what comes back, what stays Fuori.

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ConfirmBar } from "@/components/prototype/confirm-bar"
import { CodiceRow } from "@/components/prototype/screens/codice-row"
import { ScannerOverlay } from "@/components/prototype/screens/scanner-overlay"
import { SCANSIONATA, useRientro } from "@/components/prototype/screens/use-rientro"
import { cesteLabel } from "@/lib/use-svuotamento"
import { codiceOf } from "@/lib/prototype-data"
import { formatGiorno } from "@/lib/prototype-fuori"

export function RientroC() {
  const r = useRientro()

  return (
    <div className="flex min-h-svh flex-col pb-28">
      <ScannerOverlay
        ultimo={codiceOf(SCANSIONATA)}
        onAdd={r.toggle}
        title={
          <>
            <p className="text-xs tracking-wide uppercase text-white/70">Rientro</p>
            <p className="truncate text-xl font-medium">
              Ceste di {r.cliente.nome} · {r.cliente.alias[0]}
            </p>
          </>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-3 md:grid-cols-2 md:p-4">
        <section className="flex min-w-0 flex-col gap-2">
          <h2 className="flex items-baseline justify-between text-sm text-muted-foreground">
            <span>Rientrano</span>
            <span>{cesteLabel(r.rientrano.length)}</span>
          </h2>
          {r.rientrano.map((n) => (
            <CodiceRow key={n} numero={n} onClick={() => r.toggle(n)}>
              {n === SCANSIONATA && <Badge variant="secondary">Scansionata</Badge>}
              <ArrowDownIcon className="size-5 text-muted-foreground md:hidden" />
            </CodiceRow>
          ))}
          {r.rientrano.length === 0 && (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Nessuna Cesta sul rimorchio.
            </p>
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-2">
          <h2 className="flex items-baseline justify-between text-sm font-medium text-amber-800 dark:text-amber-300">
            <span>Restano Fuori con {r.cliente.nome}</span>
            <span>{cesteLabel(r.restano.length)}</span>
          </h2>
          {r.restano.map((n) => (
            <CodiceRow
              key={n}
              numero={n}
              onClick={() => r.toggle(n)}
              className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40"
            >
              <Badge
                variant="outline"
                className="border-amber-400 bg-background dark:border-amber-600"
              >
                dal {formatGiorno(r.prestito.ritiroAt)}
              </Badge>
              <ArrowUpIcon className="size-5 text-muted-foreground md:hidden" />
            </CodiceRow>
          ))}
          {r.restano.length === 0 && (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Tornano tutte.
            </p>
          )}
          <p className="px-1 text-sm text-muted-foreground">
            Tocca una Cesta per spostarla da una lista all&apos;altra.
          </p>
        </section>
      </div>

      <ConfirmBar
        count={r.spuntate.size}
        label={`Registra Rientro · ${cesteLabel(r.spuntate.size)}`}
        onConfirm={r.confirm}
      />
    </div>
  )
}
