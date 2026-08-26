"use client"
// PROTOTYPE (#31) — Etichette variant C "Elenco e anteprima". The reprint
// path of #29: the fleet as a list with a tick per Cesta, the ticked one
// previewed beside it (tablet) or in a bar at the bottom (phone).

import * as React from "react"
import { DownloadIcon, SearchIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { Codice } from "@/components/prototype/screens/codice-row"
import { Etichetta } from "@/components/prototype/screens/etichetta"
import { codiceOf } from "@/lib/prototype-data"
import { PRESTITI } from "@/lib/prototype-fuori"

const NUMERI = Array.from({ length: 12 }, (_, i) => 14 + i)
const FUORI = new Set(PRESTITI.flatMap((p) => p.numeri))

function etichetteLabel(n: number) {
  return n === 1 ? "1 Etichetta" : `${n} Etichette`
}

export function EtichettaC() {
  const [spuntate, setSpuntate] = React.useState<Set<number>>(() => new Set([17]))
  const toggle = (n: number) =>
    setSpuntate((prev) => {
      const next = new Set(prev)
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })
  const prima = [...spuntate].sort((a, b) => a - b)[0]
  const codice = prima ? codiceOf(prima) : codiceOf(17)

  return (
    <div className="flex min-h-svh flex-col gap-4 p-3 pb-48 md:p-4 md:pb-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Etichette</h1>
        <p className="text-sm text-muted-foreground">
          Spunta le Ceste da stampare · {etichetteLabel(spuntate.size)}
        </p>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="flex min-w-0 flex-col gap-2">
          <div className="relative">
            <SearchIcon className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
            <input
              inputMode="numeric"
              placeholder="Cerca per numero"
              className="h-12 w-full rounded-lg border bg-background pl-10 pr-3 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>
          {NUMERI.map((n) => {
            const on = spuntate.has(n)
            return (
              <label
                key={n}
                className={cn(
                  "flex h-14 cursor-pointer items-center gap-3 rounded-lg border bg-card px-3",
                  on && "border-foreground"
                )}
              >
                <Checkbox checked={on} onCheckedChange={() => toggle(n)} className="size-6" />
                <Codice numero={n} className="text-2xl" />
                <Badge
                  variant={FUORI.has(n) ? "outline" : "secondary"}
                  className="ml-auto"
                >
                  {FUORI.has(n) ? "Fuori" : "Disponibile"}
                </Badge>
              </label>
            )
          })}
        </section>

        <aside className="sticky top-4 hidden flex-col gap-3 self-start rounded-xl border bg-card p-4 md:flex">
          <h2 className="font-medium">Anteprima</h2>
          <div className="self-center shadow ring-1 ring-black/10">
            <Etichetta codice={codice} pxPerMm={2.6} />
          </div>
          <Button className="h-14 text-base" disabled={spuntate.size === 0}>
            <DownloadIcon data-icon="inline-start" />
            Scarica PDF · {etichetteLabel(spuntate.size)}
          </Button>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 flex items-center gap-3 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <div className="shrink-0 shadow ring-1 ring-black/10">
          <Etichetta codice={codice} pxPerMm={1} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            Anteprima di{" "}
            <span className="font-mono text-foreground tabular-nums">{codice}</span>
          </p>
          <Button className="h-16 w-full text-lg" disabled={spuntate.size === 0}>
            <DownloadIcon data-icon="inline-start" />
            PDF · {etichetteLabel(spuntate.size)}
          </Button>
        </div>
      </div>
    </div>
  )
}
