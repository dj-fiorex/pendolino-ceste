"use client"
// PROTOTYPE (#31) — Rientro variant A "Elenco spuntato" (#17, story 24).
// Viewfinder and numero field on top, the Cliente's Ceste Fuori as rows to
// tick; whatever is left unticked stays Fuori.

import { CircleCheckIcon, CircleIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ConfirmBar } from "@/components/prototype/confirm-bar"
import { CodiceRow } from "@/components/prototype/screens/codice-row"
import { NumeroDialog } from "@/components/prototype/screens/numero-dialog"
import { SCANSIONATA, useRientro } from "@/components/prototype/screens/use-rientro"
import { Viewfinder } from "@/components/prototype/screens/viewfinder"
import { cn } from "@/lib/utils"
import { cesteLabel } from "@/lib/use-svuotamento"
import { codiceOf } from "@/lib/prototype-data"
import { formatGiorno, giorniFuori, giorniLabel } from "@/lib/prototype-fuori"

export function RientroScreen() {
  const r = useRientro()

  return (
    <div className="flex min-h-svh flex-col gap-4 p-3 pb-28 md:p-4">
      <h1 className="font-heading text-lg font-medium">Rientro</h1>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section className="flex min-w-0 flex-col gap-3">
          <Viewfinder
            ultimo={codiceOf(SCANSIONATA)}
            className="aspect-video md:aspect-4/3"
          />
        </section>

        <section className="flex min-w-0 flex-col gap-2">
          <header className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3">
            <h2 className="flex flex-wrap items-center gap-x-2 text-xl font-medium">
              Ceste di {r.cliente.nome}
              <span className="text-muted-foreground">·</span>
              <span>{r.cliente.alias[0]}</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              {cesteLabel(r.prestito.numeri.length)} Fuori dal{" "}
              {formatGiorno(r.prestito.ritiroAt)} ·{" "}
              {giorniLabel(giorniFuori(r.prestito.ritiroAt))} · scansiona o
              spunta quelle sul rimorchio
            </p>
          </header>

          {r.prestito.numeri.map((n) => {
            const on = r.spuntate.has(n)
            return (
              <CodiceRow
                key={n}
                numero={n}
                onClick={() => r.toggle(n)}
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

          {r.rettifiche.map((n) => (
            <CodiceRow
              key={n}
              numero={n}
              onClick={() => r.toggle(n)}
              className={cn(
                r.spuntate.has(n) && "border-foreground bg-foreground text-background",
                r.spuntate.has(n) && "[&_.text-muted-foreground]:text-background/70"
              )}
            >
              <Badge variant="outline">Rettifica</Badge>
              {r.spuntate.has(n) ? (
                <CircleCheckIcon className="size-7" />
              ) : (
                <CircleIcon className="size-7 text-muted-foreground" />
              )}
            </CodiceRow>
          ))}

          {r.restano.length > 0 && (
            <p className="px-1 text-sm text-muted-foreground">
              {cesteLabel(r.restano.length)}{" "}
              {r.restano.length === 1 ? "resta" : "restano"} Fuori con{" "}
              {r.cliente.nome}:{" "}
              <span className="font-mono text-foreground tabular-nums">
                {r.restano.map(codiceOf).join(", ")}
              </span>
            </p>
          )}
        </section>
      </div>

      <ConfirmBar
        count={r.spuntate.size}
        label={`Registra Rientro · ${cesteLabel(r.spuntate.size)}`}
        onConfirm={r.confirm}
      >
        <NumeroDialog onAdd={r.addByNumero} />
      </ConfirmBar>
    </div>
  )
}
