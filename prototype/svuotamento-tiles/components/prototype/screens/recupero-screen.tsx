"use client"
// PROTOTYPE (#31) — the recovery list (#22, Admin). Every Cliente holding
// Ceste, worst case first, never filtered; the late threshold only highlights.

import { PhoneIcon, PhoneOffIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Codice } from "@/components/prototype/screens/codice-row"
import { cesteLabel } from "@/lib/use-svuotamento"
import {
  clienteById,
  formatGiorno,
  giorniFuori,
  giorniLabel,
  PRESTITI,
  SOGLIA_RITARDO,
} from "@/lib/prototype-fuori"

export function RecuperoScreen() {
  const righe = PRESTITI.map((p) => ({
    ...p,
    cliente: clienteById(p.clienteId),
    giorni: giorniFuori(p.ritiroAt),
  })).sort((a, b) => b.giorni - a.giorni)

  const totale = righe.reduce((n, r) => n + r.numeri.length, 0)

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-4 p-3 md:p-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Lista di recupero</h1>
        <p className="text-sm text-muted-foreground">
          {righe.length} Clienti · {cesteLabel(totale)} Fuori · in ritardo oltre{" "}
          {SOGLIA_RITARDO} giorni
        </p>
      </header>

      <ol className="flex flex-col gap-3">
        {righe.map((r) => {
          const late = r.giorni > SOGLIA_RITARDO
          return (
            <li
              key={r.clienteId}
              className={cn(
                "flex flex-col gap-3 rounded-xl border bg-card p-4",
                late &&
                  "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xl font-medium">{r.cliente.nome}</span>
                    {r.cliente.alias.map((a) => (
                      <Badge key={a} variant="secondary">
                        {a}
                      </Badge>
                    ))}
                    {late && (
                      <Badge className="bg-amber-600 text-white dark:bg-amber-500 dark:text-amber-950">
                        In ritardo
                      </Badge>
                    )}
                  </div>
                  <p className="text-2xl font-semibold tabular-nums">
                    {giorniLabel(r.giorni)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {cesteLabel(r.numeri.length)} · Ritiro del {formatGiorno(r.ritiroAt)}
                  </p>
                </div>
                {r.cliente.telefono ? (
                  <Button
                    variant="outline"
                    className="h-12 shrink-0 px-4 text-base tabular-nums"
                    render={<a href={`tel:${r.cliente.telefono.replace(/\s/g, "")}`} />}
                    nativeButton={false}
                  >
                    <PhoneIcon data-icon="inline-start" />
                    {r.cliente.telefono}
                  </Button>
                ) : (
                  <span className="flex h-12 shrink-0 items-center gap-2 px-2 text-sm text-muted-foreground">
                    <PhoneOffIcon className="size-4" />
                    Nessun telefono
                  </span>
                )}
              </div>
              <ul className="flex flex-wrap gap-2">
                {r.numeri.map((n) => (
                  <li
                    key={n}
                    className="rounded-md border bg-background px-2 py-1 text-sm"
                  >
                    <Codice numero={n} />
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
