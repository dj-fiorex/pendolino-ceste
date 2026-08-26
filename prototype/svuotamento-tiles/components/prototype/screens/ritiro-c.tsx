"use client"
// PROTOTYPE (#31) — Ritiro variant C "Camera a tutta larghezza". The camera
// runs edge to edge across the top with the Cliente and the numero field
// laid over it; below, two lists side by side: this Ritiro, and what the
// Cliente already has Fuori with the date of each Ritiro.

import { TriangleAlertIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmBar } from "@/components/prototype/confirm-bar"
import { CodiceRow } from "@/components/prototype/screens/codice-row"
import { NumeroDialog } from "@/components/prototype/screens/numero-dialog"
import { ScannerOverlay } from "@/components/prototype/screens/scanner-overlay"
import { useRitiro } from "@/components/prototype/screens/use-ritiro"
import { cesteLabel } from "@/lib/use-svuotamento"
import { codiceOf } from "@/lib/prototype-data"
import { formatGiorno } from "@/lib/prototype-fuori"

export function RitiroC() {
  const r = useRitiro()

  return (
    <div className="flex min-h-svh flex-col pb-28">
      <ScannerOverlay
        ultimo={r.ultimo ? codiceOf(r.ultimo) : undefined}
        title={
          <>
            <p className="text-xs tracking-wide uppercase text-white/70">Ritiro</p>
            <p className="truncate text-xl font-medium">{r.cliente.nome}</p>
          </>
        }
        action={
          <Button
            variant="ghost"
            className="h-9 shrink-0 text-white hover:bg-white/20 hover:text-white"
          >
            Cambia
          </Button>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-3 md:grid-cols-2 md:p-4">
        <section className="flex min-w-0 flex-col gap-2">
          <h2 className="flex items-baseline justify-between text-sm text-muted-foreground">
            <span>Questo Ritiro</span>
            <span>{cesteLabel(r.lista.length)}</span>
          </h2>
          {r.lista.map((numero) => (
            <CodiceRow key={numero} numero={numero}>
              <Button
                variant="ghost"
                size="icon"
                className="size-10"
                onClick={() => r.remove(numero)}
              >
                <XIcon />
                <span className="sr-only">Togli {codiceOf(numero)}</span>
              </Button>
            </CodiceRow>
          ))}
        </section>

        <section className="flex min-w-0 flex-col gap-2">
          <h2 className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
            <TriangleAlertIcon className="size-4" />
            <span>
              Già Fuori dal {formatGiorno(r.prestito.ritiroAt)} ·{" "}
              {cesteLabel(r.prestito.numeri.length)}
            </span>
          </h2>
          {r.prestito.numeri.map((numero) => (
            <CodiceRow
              key={numero}
              numero={numero}
              className="border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40"
            >
              <Badge
                variant="outline"
                className="border-amber-400 bg-background dark:border-amber-600"
              >
                dal {formatGiorno(r.prestito.ritiroAt)}
              </Badge>
            </CodiceRow>
          ))}
          <p className="px-1 text-sm text-muted-foreground">
            Chiedile indietro prima di consegnarne altre. Il Ritiro va avanti
            comunque.
          </p>
        </section>
      </div>

      <ConfirmBar
        count={r.lista.length}
        label={`Conferma Ritiro · ${cesteLabel(r.lista.length)}`}
        onConfirm={r.confirm}
      >
        <NumeroDialog onAdd={r.add} />
      </ConfirmBar>
    </div>
  )
}
