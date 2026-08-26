"use client"
// PROTOTYPE (#31) — the numero field that sits beside the scanner, never
// behind a mode switch (#23). Takes only the numero; the list echoes the
// full Codice.

import * as React from "react"
import { PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { codiceOf } from "@/lib/prototype-data"

export function NumeroField({ onAdd }: { onAdd: (numero: number) => void }) {
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
    <form onSubmit={submit} className="flex flex-col gap-1.5">
      <label htmlFor="numero" className="text-sm text-muted-foreground">
        Oppure scrivi il numero
        {echo && (
          <span className="ml-2 font-mono text-foreground tabular-nums">{echo}</span>
        )}
      </label>
      <div className="flex gap-2">
        <input
          id="numero"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={3}
          size={4}
          placeholder="Numero"
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
          className="h-14 w-0 min-w-0 flex-1 rounded-lg border bg-background px-4 font-mono text-2xl tabular-nums outline-none placeholder:font-sans placeholder:text-base placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <Button
          type="submit"
          variant="outline"
          className="h-14 px-5 text-base"
          disabled={!echo}
        >
          <PlusIcon data-icon="inline-start" />
          Aggiungi
        </Button>
      </div>
    </form>
  )
}
