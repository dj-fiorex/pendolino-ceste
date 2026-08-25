"use client"
// PROTOTYPE (#30) — the fixed, full-width "Svuota N Ceste" bar.

import { Button } from "@/components/ui/button"
import { confirmLabel } from "@/lib/use-svuotamento"

export function ConfirmBar({
  count,
  onConfirm,
  children,
}: {
  count: number
  onConfirm: () => void
  /** Optional extra control (e.g. the keypad trigger) beside the button. */
  children?: React.ReactNode
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 flex items-center gap-3 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      {children}
      <Button
        size="lg"
        className="h-16 flex-1 text-xl"
        disabled={count === 0}
        onClick={onConfirm}
      >
        {confirmLabel(count)}
      </Button>
    </div>
  )
}
