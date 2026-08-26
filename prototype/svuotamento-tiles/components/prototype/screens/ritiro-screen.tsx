"use client"
// PROTOTYPE (#31) — Ritiro with the warning at the counter (#16, #22, #23).
// Cliente picked, scanner open, four Ceste scanned, and the inline notice that
// Giuseppe Amato already holds three Fuori. The warning never blocks.

import * as React from "react"
import { TriangleAlertIcon, UserRoundIcon, XIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmBar } from "@/components/prototype/confirm-bar"
import { CodiceRow } from "@/components/prototype/screens/codice-row"
import { NumeroField } from "@/components/prototype/screens/numero-field"
import { Viewfinder } from "@/components/prototype/screens/viewfinder"
import { cesteLabel } from "@/lib/use-svuotamento"
import { codiceOf } from "@/lib/prototype-data"
import {
  clienteById,
  formatGiorno,
  prestitoDi,
} from "@/lib/prototype-fuori"

const SCANSIONATE = [23, 24, 41, 172]

export function RitiroScreen() {
  const cliente = clienteById("amato")
  const prestito = prestitoDi("amato")
  const [lista, setLista] = React.useState<number[]>(SCANSIONATE)

  const add = (numero: number) =>
    setLista((prev) => (prev.includes(numero) ? prev : [...prev, numero]))
  const remove = (numero: number) =>
    setLista((prev) => prev.filter((n) => n !== numero))

  const ultimo = lista.at(-1)

  return (
    <div className="flex min-h-svh flex-col gap-4 p-3 pb-28 md:p-4">
      <header className="flex flex-col gap-3">
        <h1 className="font-heading text-lg font-medium">Ritiro</h1>
        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
          <UserRoundIcon className="size-6 text-muted-foreground" />
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <span className="text-xl font-medium">{cliente.nome}</span>
            {cliente.alias.map((a) => (
              <Badge key={a} variant="secondary">
                {a}
              </Badge>
            ))}
          </div>
          <Button variant="ghost" className="h-10">
            Cambia
          </Button>
        </div>
        <Alert className="border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50 [&>svg]:text-amber-700 dark:[&>svg]:text-amber-300">
          <TriangleAlertIcon />
          <AlertTitle className="text-base">
            {cliente.nome} ha già {cesteLabel(prestito.numeri.length)} Fuori dal{" "}
            {formatGiorno(prestito.ritiroAt)}:
          </AlertTitle>
          <AlertDescription className="font-mono text-base text-inherit tabular-nums">
            {prestito.numeri.map(codiceOf).join(", ")}
          </AlertDescription>
        </Alert>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section className="flex min-w-0 flex-col gap-3">
          <Viewfinder
            ultimo={ultimo ? codiceOf(ultimo) : undefined}
            className="aspect-4/3"
          />
          <NumeroField onAdd={add} />
        </section>

        <section className="flex min-w-0 flex-col gap-2">
          <h2 className="flex items-baseline justify-between text-sm text-muted-foreground">
            <span>Ceste del Ritiro</span>
            <span>{cesteLabel(lista.length)}</span>
          </h2>
          {lista.map((numero) => (
            <CodiceRow key={numero} numero={numero}>
              <Button
                variant="ghost"
                size="icon"
                className="size-10"
                onClick={() => remove(numero)}
              >
                <XIcon />
                <span className="sr-only">Togli {codiceOf(numero)}</span>
              </Button>
            </CodiceRow>
          ))}
          {lista.length === 0 && (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Scansiona la prima Cesta o scrivi il numero.
            </p>
          )}
        </section>
      </div>

      <ConfirmBar
        count={lista.length}
        label={`Conferma Ritiro · ${cesteLabel(lista.length)}`}
        onConfirm={() => setLista([])}
      />
    </div>
  )
}
