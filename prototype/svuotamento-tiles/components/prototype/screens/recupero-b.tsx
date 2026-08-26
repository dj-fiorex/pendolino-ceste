"use client"
// PROTOTYPE (#31) — recupero variant B "Tabella". One dense row per Cliente,
// days as the loudest number, Codici behind a chevron; late rows carry an
// amber edge. Reads like the ledger an Admin would print.

import * as React from "react"
import { ChevronDownIcon, PhoneIcon, PhoneOffIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Codice } from "@/components/prototype/screens/codice-row"
import { cesteLabel } from "@/lib/use-svuotamento"
import {
  clienteById,
  formatGiorno,
  giorniFuori,
  PRESTITI,
  SOGLIA_RITARDO,
} from "@/lib/prototype-fuori"

export function RecuperoB() {
  const righe = PRESTITI.map((p) => ({
    ...p,
    cliente: clienteById(p.clienteId),
    giorni: giorniFuori(p.ritiroAt),
  })).sort((a, b) => b.giorni - a.giorni)
  const totale = righe.reduce((n, r) => n + r.numeri.length, 0)
  const [open, setOpen] = React.useState<string | null>(righe[0].clienteId)

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-4xl flex-col gap-4 p-3 md:p-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Lista di recupero</h1>
        <p className="text-sm text-muted-foreground">
          {righe.length} Clienti · {cesteLabel(totale)} Fuori · in ritardo oltre{" "}
          {SOGLIA_RITARDO} giorni
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="hidden grid-cols-[minmax(0,1fr)_7rem_5rem_10rem_2.5rem] gap-3 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground md:grid">
          <span>Cliente</span>
          <span className="text-right">Giorni Fuori</span>
          <span className="text-right">Ceste</span>
          <span>Telefono</span>
          <span />
        </div>
        {righe.map((r) => {
          const late = r.giorni > SOGLIA_RITARDO
          const isOpen = open === r.clienteId
          const tel = r.cliente.telefono
          return (
            <div
              key={r.clienteId}
              className={cn(
                "border-b last:border-b-0",
                late &&
                  "border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/40"
              )}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => setOpen(isOpen ? null : r.clienteId)}
                onKeyDown={(e) => e.key === "Enter" && setOpen(isOpen ? null : r.clienteId)}
                className="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 px-3 py-3 text-left md:grid-cols-[minmax(0,1fr)_7rem_5rem_10rem_2.5rem]"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-medium">{r.cliente.nome}</span>
                    {r.cliente.alias.map((a) => (
                      <Badge key={a} variant="secondary">
                        {a}
                      </Badge>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    <span className="md:hidden">{cesteLabel(r.numeri.length)} · </span>
                    Ritiro del {formatGiorno(r.ritiroAt)}
                  </span>
                </div>
                <span className="text-right text-2xl font-semibold tabular-nums">
                  {r.giorni}
                  <span className="text-xs font-normal text-muted-foreground"> gg</span>
                </span>
                <span className="hidden text-right text-base tabular-nums md:block">
                  {r.numeri.length}
                </span>
                <span className="hidden md:block">
                  {tel ? (
                    <a
                      href={`tel:${tel.replace(/\s/g, "")}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 underline underline-offset-4 tabular-nums"
                    >
                      <PhoneIcon className="size-4" />
                      {tel}
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <PhoneOffIcon className="size-4" />
                      nessuno
                    </span>
                  )}
                </span>
                <span className="md:hidden">
                  {tel ? (
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-10"
                      render={<a href={`tel:${tel.replace(/\s/g, "")}`} />}
                      nativeButton={false}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <PhoneIcon />
                      <span className="sr-only">Chiama {tel}</span>
                    </Button>
                  ) : (
                    <span className="flex size-10 items-center justify-center text-muted-foreground">
                      <PhoneOffIcon className="size-4" />
                    </span>
                  )}
                </span>
                <ChevronDownIcon
                  className={cn(
                    "size-5 justify-self-end text-muted-foreground transition-transform",
                    isOpen && "rotate-180"
                  )}
                />
              </div>
              {isOpen && (
                <ul className="flex flex-wrap gap-2 px-3 pb-3">
                  {r.numeri.map((n) => (
                    <li
                      key={n}
                      className="rounded-md border bg-background px-2 py-1 text-sm"
                    >
                      <Codice numero={n} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
