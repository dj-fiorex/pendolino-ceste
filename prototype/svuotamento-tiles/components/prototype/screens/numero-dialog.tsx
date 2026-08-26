"use client"
// PROTOTYPE (#31) — manual entry the way #18 chose it for the Svuotamento:
// a large "Numero" key opens the keypad in a Dialog, the typed numero is
// echoed as its full Codice, and the result is reported in place. Never the
// device's own keyboard.

import { HashIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Keypad } from "@/components/prototype/keypad"
import { cn } from "@/lib/utils"
import type { AddResult } from "@/lib/use-svuotamento"

export function NumeroDialog({
  onAdd,
  className,
}: {
  onAdd: (numero: number) => AddResult
  className?: string
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" className={cn("h-16 px-5 text-lg", className)} />
        }
      >
        <HashIcon data-icon="inline-start" />
        Numero
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aggiungi per numero</DialogTitle>
        </DialogHeader>
        <Keypad onAdd={onAdd} keyClass="h-20 text-3xl" />
      </DialogContent>
    </Dialog>
  )
}
