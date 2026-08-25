"use client"
// PROTOTYPE (#30) — one Cesta tile. Size is the thing under test.

import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { Cesta } from "@/lib/prototype-data"

export type TileSize = 64 | 80 | 96

const SIZE_CLASS: Record<TileSize, string> = {
  64: "size-16",
  80: "size-20",
  96: "size-24",
}

const PREFIX_CLASS: Record<TileSize, string> = {
  64: "text-[10px]",
  80: "text-xs",
  96: "text-sm",
}

const NUMERO_CLASS: Record<TileSize, string> = {
  64: "text-xl",
  80: "text-2xl",
  96: "text-3xl",
}

export function Tile({
  cesta,
  selected,
  size,
  onToggle,
}: {
  cesta: Cesta
  selected: boolean
  size: TileSize
  onToggle: () => void
}) {
  return (
    <Button
      variant={selected ? "default" : "outline"}
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        "relative flex-col gap-0.5 rounded-xl px-1",
        SIZE_CLASS[size]
      )}
    >
      <span
        className={cn(
          "leading-none",
          PREFIX_CLASS[size],
          selected ? "text-primary-foreground/70" : "text-muted-foreground"
        )}
      >
        {cesta.portata}-{cesta.forma}
      </span>
      <span
        className={cn("leading-none font-semibold tabular-nums", NUMERO_CLASS[size])}
      >
        {String(cesta.numero).padStart(3, "0")}
      </span>
      {selected && <CheckIcon className="absolute top-1 right-1 size-3.5" />}
    </Button>
  )
}
