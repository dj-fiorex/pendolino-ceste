"use client"
// PROTOTYPE (#30, #31) — floating variant switcher. Top-centre rather than
// the usual bottom-centre because the screens under test own the bottom
// edge with their fixed confirm bars.

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  isVariantKey,
  SCREEN_VARIANTS,
  type Variant,
  type VariantKey,
} from "@/lib/variants"

export { isVariantKey, type VariantKey }

/** The Svuotamento list, kept for the #30 page. */
export const VARIANTS = SCREEN_VARIANTS.svuotamento

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA"
  )
}

export function PrototypeSwitcher({
  current,
  onChange,
  variants = VARIANTS,
}: {
  current: VariantKey
  onChange: (key: VariantKey) => void
  variants?: readonly Variant[]
}) {
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current)
  )
  const prev = variants[(index - 1 + variants.length) % variants.length].key
  const next = variants[(index + 1) % variants.length].key

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return
      if (event.key === "ArrowLeft") onChange(prev)
      if (event.key === "ArrowRight") onChange(next)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [prev, next, onChange])

  if (process.env.NODE_ENV === "production") return null

  return (
    <div className="fixed top-2 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-foreground p-1 text-background shadow-lg">
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full text-background hover:bg-background/20 hover:text-background"
        onClick={() => onChange(prev)}
      >
        <ChevronLeftIcon />
        <span className="sr-only">Variante precedente</span>
      </Button>
      <span className="px-2 font-mono text-xs">
        {variants[index].key} ({variants[index].name})
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-full text-background hover:bg-background/20 hover:text-background"
        onClick={() => onChange(next)}
      >
        <ChevronRightIcon />
        <span className="sr-only">Variante successiva</span>
      </Button>
    </div>
  )
}
