"use client"
// PROTOTYPE (#31) — a fake camera viewfinder. Dark box, corner brackets, a
// scan line, and the last Codice read. No camera is ever opened.
// `compact` is the docked thumbnail of variant B; `caption` and `frameClass`
// let variant C's overlay keep its title and field clear of the brackets.

import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export function Viewfinder({
  ultimo,
  compact = false,
  caption = !compact,
  frameClass,
  className,
  children,
}: {
  /** Codice of the last successful scan, shown as a pill. */
  ultimo?: string
  compact?: boolean
  caption?: boolean
  /** Inset of the bracket frame; defaults suit a free-standing viewfinder. */
  frameClass?: string
  className?: string
  /** Anything overlaid on the camera (variant C puts the numero field here). */
  children?: React.ReactNode
}) {
  const corner = "absolute border-white/90 " + (compact ? "size-3" : "size-7")
  const w = compact ? "2" : "4"
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl bg-neutral-900 bg-[radial-gradient(ellipse_at_center,#3a3a3a_0%,#171717_70%)]",
        className
      )}
    >
      <div className={cn("absolute", frameClass ?? (compact ? "inset-[20%]" : "inset-[14%]"))}>
        <span className={cn(corner, "top-0 left-0 rounded-tl-lg", `border-t-${w} border-l-${w}`)} />
        <span className={cn(corner, "top-0 right-0 rounded-tr-lg", `border-t-${w} border-r-${w}`)} />
        <span className={cn(corner, "bottom-0 left-0 rounded-bl-lg", `border-b-${w} border-l-${w}`)} />
        <span className={cn(corner, "right-0 bottom-0 rounded-br-lg", `border-r-${w} border-b-${w}`)} />
        <span className="absolute inset-x-2 top-[46%] h-0.5 bg-white/60 shadow-[0_0_12px_2px_rgba(255,255,255,0.5)]" />
      </div>
      {caption && (
        <p className="absolute inset-x-0 top-3 text-center text-sm text-white/70">
          Inquadra il QR della Cesta
        </p>
      )}
      {ultimo && (
        <div
          className={cn(
            "absolute flex items-center gap-1.5 rounded-full bg-white font-medium whitespace-nowrap text-neutral-900",
            compact
              ? "bottom-1 left-1 px-1.5 py-0.5 text-[10px]"
              : "bottom-3 left-3 px-3 py-1.5 text-sm"
          )}
        >
          {!compact && <CheckIcon className="size-4" />}
          <span className="font-mono tabular-nums">{ultimo}</span>
        </div>
      )}
      {children}
    </div>
  )
}

// Keep Tailwind's scanner from dropping the widths built above.
// border-t-2 border-l-2 border-r-2 border-b-2 border-t-4 border-l-4 border-r-4 border-b-4
