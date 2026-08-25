"use client"
// PROTOTYPE (#30) — floating variant switcher. Top-centre rather than the
// usual bottom-centre because the screen under test owns the bottom edge
// with its fixed confirm bar.

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export const VARIANTS = [
  { key: "A", name: "Griglia 64" },
  { key: "B", name: "Schede 96" },
  { key: "C", name: "Per Cliente 80" },
] as const

export type VariantKey = (typeof VARIANTS)[number]["key"]

export function isVariantKey(value: string | null): value is VariantKey {
  return VARIANTS.some((v) => v.key === value)
}

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
}: {
  current: VariantKey
  onChange: (key: VariantKey) => void
}) {
  const index = VARIANTS.findIndex((v) => v.key === current)
  const prev = VARIANTS[(index - 1 + VARIANTS.length) % VARIANTS.length].key
  const next = VARIANTS[(index + 1) % VARIANTS.length].key

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
        {current} ({VARIANTS[index].name})
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
