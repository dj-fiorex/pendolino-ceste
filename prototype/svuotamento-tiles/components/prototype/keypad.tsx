"use client"
// PROTOTYPE (#30) — the large-key numero keypad. Never the system keyboard.

import * as React from "react"
import { CornerDownLeftIcon, DeleteIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { codiceOf } from "@/lib/prototype-data"
import type { AddResult } from "@/lib/use-svuotamento"

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]

export function Keypad({
  onAdd,
  keyClass = "h-16 text-2xl",
  className,
}: {
  onAdd: (numero: number) => AddResult
  /** Height and type size of one key; the thing under test. */
  keyClass?: string
  className?: string
}) {
  const [value, setValue] = React.useState("")
  const [result, setResult] = React.useState<AddResult | null>(null)

  const numero = value === "" ? null : Number(value)
  const echo = numero && numero >= 1 && numero <= 195 ? codiceOf(numero) : null

  function press(digit: string) {
    if (value.length >= 3) return
    setValue(value + digit)
    setResult(null)
  }

  function submit() {
    if (numero === null) return
    setResult(onAdd(numero))
    setValue("")
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex h-14 items-center justify-between rounded-lg border bg-muted/50 px-3">
        <span className="font-mono text-3xl tabular-nums">
          {value || <span className="text-muted-foreground">···</span>}
        </span>
        {echo && <Badge variant="outline">{echo}</Badge>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((k) => (
          <Button
            key={k}
            variant="outline"
            className={keyClass}
            onClick={() => press(k)}
          >
            {k}
          </Button>
        ))}
        <Button
          variant="outline"
          className={keyClass}
          onClick={() => setValue(value.slice(0, -1))}
        >
          <DeleteIcon />
          <span className="sr-only">Cancella</span>
        </Button>
        <Button variant="outline" className={keyClass} onClick={() => press("0")}>
          0
        </Button>
        <Button className={keyClass} disabled={numero === null} onClick={submit}>
          <CornerDownLeftIcon />
          <span className="sr-only">Aggiungi</span>
        </Button>
      </div>
      {result && (
        <Alert variant={result.ok ? "default" : "destructive"}>
          <AlertTitle>{result.message}</AlertTitle>
        </Alert>
      )}
    </div>
  )
}
