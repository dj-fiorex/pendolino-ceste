"use client"
// PROTOTYPE (#31) — recupero variant C "Per fascia di giorni". The list is
// cut into three bands (past the threshold, middle, last three days) with a
// days counter as a tile and a round call button per row. Every Cliente is
// still there: the bands sort, they never hide.

import { PhoneIcon, PhoneOffIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { cesteLabel } from "@/lib/use-svuotamento"
import { codiceOf } from "@/lib/prototype-data"
import {
  clienteById,
  formatGiorno,
  giorniFuori,
  PRESTITI,
  SOGLIA_RITARDO,
} from "@/lib/prototype-fuori"

const FASCE = [
  {
    key: "ritardo",
    label: `In ritardo · oltre ${SOGLIA_RITARDO} giorni`,
    test: (g: number) => g > SOGLIA_RITARDO,
    late: true,
  },
  {
    key: "medio",
    label: `Da 4 a ${SOGLIA_RITARDO} giorni`,
    test: (g: number) => g > 3 && g <= SOGLIA_RITARDO,
    late: false,
  },
  {
    key: "recenti",
    label: "Ultimi 3 giorni",
    test: (g: number) => g <= 3,
    late: false,
  },
]

export function RecuperoC() {
  const righe = PRESTITI.map((p) => ({
    ...p,
    cliente: clienteById(p.clienteId),
    giorni: giorniFuori(p.ritiroAt),
  })).sort((a, b) => b.giorni - a.giorni)
  const totale = righe.reduce((n, r) => n + r.numeri.length, 0)

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-5 p-3 md:p-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-heading text-lg font-medium">Lista di recupero</h1>
        <p className="text-sm text-muted-foreground">
          {righe.length} Clienti · {cesteLabel(totale)} Fuori
        </p>
      </header>

      {FASCE.map((f) => {
        const rows = righe.filter((r) => f.test(r.giorni))
        return (
          <section key={f.key} className="flex flex-col gap-2">
            <h2
              className={cn(
                "flex items-center gap-2 text-xs font-medium tracking-wide uppercase",
                f.late ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground"
              )}
            >
              {f.label}
              <Badge
                className={cn(
                  f.late
                    ? "bg-amber-600 text-white dark:bg-amber-500 dark:text-amber-950"
                    : ""
                )}
                variant={f.late ? "default" : "secondary"}
              >
                {rows.length}
              </Badge>
            </h2>
            {rows.length === 0 && (
              <p className="px-1 text-sm text-muted-foreground">Nessuno.</p>
            )}
            {rows.map((r) => {
              const tel = r.cliente.telefono
              return (
                <div
                  key={r.clienteId}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border bg-card p-3",
                    f.late && "border-amber-300 dark:border-amber-700"
                  )}
                >
                  <div
                    className={cn(
                      "flex size-14 shrink-0 flex-col items-center justify-center rounded-lg bg-muted",
                      f.late &&
                        "bg-amber-100 text-amber-950 dark:bg-amber-900 dark:text-amber-50"
                    )}
                  >
                    <span className="text-2xl leading-none font-semibold tabular-nums">
                      {r.giorni}
                    </span>
                    <span className="text-[10px] uppercase">giorni</span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-base font-medium">
                        {r.cliente.nome}
                      </span>
                      {r.cliente.alias.map((a) => (
                        <Badge key={a} variant="secondary">
                          {a}
                        </Badge>
                      ))}
                    </div>
                    <p className="font-mono text-sm text-muted-foreground tabular-nums">
                      {r.numeri.map(codiceOf).join("  ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {cesteLabel(r.numeri.length)} · Ritiro del {formatGiorno(r.ritiroAt)}
                    </p>
                  </div>
                  {tel ? (
                    <Button
                      size="icon"
                      className="size-12 shrink-0 rounded-full"
                      render={<a href={`tel:${tel.replace(/\s/g, "")}`} />}
                      nativeButton={false}
                    >
                      <PhoneIcon className="size-5" />
                      <span className="sr-only">Chiama {tel}</span>
                    </Button>
                  ) : (
                    <span
                      className="flex size-12 shrink-0 items-center justify-center rounded-full border border-dashed text-muted-foreground"
                      title="Nessun telefono"
                    >
                      <PhoneOffIcon className="size-5" />
                    </span>
                  )}
                </div>
              )
            })}
          </section>
        )
      })}

      <p className="px-1 text-xs text-muted-foreground">
        Tutti i {righe.length} Clienti con Ceste Fuori sono in elenco: la
        soglia evidenzia, non nasconde.
      </p>
    </div>
  )
}
