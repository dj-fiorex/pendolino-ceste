"use client"
// PROTOTYPE (#31) — Rientro (#17): one Cesta scanned tells the app whose the
// load is; the Cliente's Ceste Fuori are listed, the ones on the trailer are
// ticked, and whatever is left unticked stays Fuori (story 24).

import * as React from "react"
import { CircleCheckIcon, CircleIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ConfirmBar } from "@/components/prototype/confirm-bar"
import { CodiceRow } from "@/components/prototype/screens/codice-row"
import { NumeroField } from "@/components/prototype/screens/numero-field"
import { Viewfinder } from "@/components/prototype/screens/viewfinder"
import { cn } from "@/lib/utils"
import { cesteLabel } from "@/lib/use-svuotamento"
import { codiceOf } from "@/lib/prototype-data"
import {
  clienteById,
  formatGiorno,
  giorniLabel,
  giorniFuori,
  prestitoDi,
} from "@/lib/prototype-fuori"

const SCANSIONATA = 3

export function RientroScreen() {
  const cliente = clienteById("russo")
  const prestito = prestitoDi("russo")
  const [spuntate, setSpuntate] = React.useState<Set<number>>(
    () => new Set(prestito.numeri.filter((n) => n !== 175))
  )

  const toggle = (n: number) =>
    setSpuntate((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })

  const restano = prestito.numeri.filter((n) => !spuntate.has(n))

  return (
    <div className="flex min-h-svh flex-col gap-4 p-3 pb-28 md:p-4">
      <h1 className="font-heading text-lg font-medium">Rientro</h1>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section className="flex min-w-0 flex-col gap-3">
          <Viewfinder
            ultimo={codiceOf(SCANSIONATA)}
            className="aspect-video md:aspect-4/3"
          />
          <NumeroField onAdd={toggle} />
        </section>

        <section className="flex min-w-0 flex-col gap-2">
          <header className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3">
            <h2 className="flex flex-wrap items-center gap-x-2 text-xl font-medium">
              Ceste di {cliente.nome}
              <span className="text-muted-foreground">·</span>
              <span>{cliente.alias[0]}</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              {cesteLabel(prestito.numeri.length)} Fuori dal{" "}
              {formatGiorno(prestito.ritiroAt)} ·{" "}
              {giorniLabel(giorniFuori(prestito.ritiroAt))} · scansiona o spunta
              quelle sul rimorchio
            </p>
          </header>

          {prestito.numeri.map((n) => {
            const on = spuntate.has(n)
            return (
              <CodiceRow
                key={n}
                numero={n}
                onClick={() => toggle(n)}
                className={cn(
                  on && "border-foreground bg-foreground text-background",
                  on && "[&_.text-muted-foreground]:text-background/70"
                )}
              >
                {n === SCANSIONATA && (
                  <Badge variant={on ? "secondary" : "outline"}>Scansionata</Badge>
                )}
                {!on && <Badge variant="outline">Resta Fuori</Badge>}
                {on ? (
                  <CircleCheckIcon className="size-7" />
                ) : (
                  <CircleIcon className="size-7 text-muted-foreground" />
                )}
              </CodiceRow>
            )
          })}

          {restano.length > 0 && (
            <p className="px-1 text-sm text-muted-foreground">
              {cesteLabel(restano.length)} {restano.length === 1 ? "resta" : "restano"}{" "}
              Fuori con {cliente.nome}:{" "}
              <span className="font-mono text-foreground tabular-nums">
                {restano.map(codiceOf).join(", ")}
              </span>
            </p>
          )}
        </section>
      </div>

      <ConfirmBar
        count={spuntate.size}
        label={`Registra Rientro · ${cesteLabel(spuntate.size)}`}
        onConfirm={() => setSpuntate(new Set())}
      />
    </div>
  )
}
