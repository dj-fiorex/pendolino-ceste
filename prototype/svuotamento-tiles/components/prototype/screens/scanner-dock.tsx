"use client"
// PROTOTYPE (#31) — variant B's bottom dock: a thumbnail viewfinder and the
// "Numero" key (keypad in a Dialog, as #18 chose) in one row, the confirm
// button under them. Thumb-reach on a phone; the list above gets the screen.

import { Button } from "@/components/ui/button"
import { NumeroDialog } from "@/components/prototype/screens/numero-dialog"
import { Viewfinder } from "@/components/prototype/screens/viewfinder"
import type { AddResult } from "@/lib/use-svuotamento"

export function ScannerDock({
  ultimo,
  onAdd,
  label,
  disabled,
  onConfirm,
}: {
  ultimo?: string
  onAdd: (numero: number) => AddResult
  label: string
  disabled?: boolean
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 flex flex-col gap-3 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl gap-3">
        <Viewfinder ultimo={ultimo} compact className="h-14 w-28 shrink-0 rounded-lg" />
        <NumeroDialog onAdd={onAdd} className="h-14 flex-1" />
      </div>
      <Button
        size="lg"
        className="mx-auto h-16 w-full max-w-3xl text-xl"
        disabled={disabled}
        onClick={onConfirm}
      >
        {label}
      </Button>
    </div>
  )
}
