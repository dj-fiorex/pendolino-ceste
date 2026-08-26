"use client"
// PROTOTYPE (#31) — the numero field that sits beside the scanner, never
// behind a mode switch (#23). Takes only the numero; the list echoes the
// full Codice. `compact` drops the label and echoes the Codice inside the row.

import * as React from "react"
import { PlusIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { codiceOf } from "@/lib/prototype-data"

export function NumeroField({
  onAdd,
  compact = false,
  className,
}: {
  onAdd: (numero: number) => void
  compact?: boolean
  className?: string
}) {
  const [value, setValue] = React.useState("")
  const numero = value === "" ? null : Number(value)
  const echo = numero && numero >= 1 && numero <= 195 ? codiceOf(numero) : null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (numero === null || !echo) return
    onAdd(numero)
    setValue("")
  }

  return (
    <form onSubmit={submit} className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {!compact && (
        <label htmlFor="numero" className="text-sm text-muted-foreground">
          Oppure scrivi il numero
          {echo && (
            <span className="ml-2 font-mono text-foreground tabular-nums">{echo}</span>
          )}
        </label>
      )}
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            id="numero"
            aria-label={compact ? "Numero della Cesta" : undefined}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
            size={4}
            placeholder="Numero"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
            className="h-14 w-full min-w-0 rounded-lg border bg-background px-4 font-mono text-2xl tabular-nums outline-none placeholder:font-sans placeholder:text-base placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          {compact && echo && (
            <Badge
              variant="outline"
              className="absolute top-1/2 right-2 -translate-y-1/2 font-mono tabular-nums"
            >
              {echo}
            </Badge>
          )}
        </div>
        <Button
          type="submit"
          variant="outline"
          className={cn("h-14 text-base", compact ? "w-14 px-0" : "px-5")}
          disabled={!echo}
        >
          <PlusIcon data-icon={compact ? undefined : "inline-start"} />
          {compact ? <span className="sr-only">Aggiungi</span> : "Aggiungi"}
        </Button>
      </div>
    </form>
  )
}
