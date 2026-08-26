"use client"
// PROTOTYPE (#31) — a fake camera viewfinder. Dark box, corner brackets, a
// scan line, and the last Codice read. No camera is ever opened.

import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const CORNER = "absolute size-7 border-white/90"

export function Viewfinder({
  ultimo,
  className,
}: {
  /** Codice of the last successful scan, shown as a pill. */
  ultimo?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl bg-neutral-900 bg-[radial-gradient(ellipse_at_center,_#3a3a3a_0%,_#171717_70%)]",
        className
      )}
    >
      <div className="absolute inset-[14%]">
        <span className={cn(CORNER, "top-0 left-0 rounded-tl-lg border-t-4 border-l-4")} />
        <span className={cn(CORNER, "top-0 right-0 rounded-tr-lg border-t-4 border-r-4")} />
        <span className={cn(CORNER, "bottom-0 left-0 rounded-bl-lg border-b-4 border-l-4")} />
        <span className={cn(CORNER, "right-0 bottom-0 rounded-br-lg border-r-4 border-b-4")} />
        <span className="absolute inset-x-2 top-[46%] h-0.5 bg-white/60 shadow-[0_0_12px_2px_rgba(255,255,255,0.5)]" />
      </div>
      <p className="absolute inset-x-0 top-3 text-center text-sm text-white/70">
        Inquadra il QR della Cesta
      </p>
      {ultimo && (
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-neutral-900">
          <CheckIcon className="size-4" />
          <span className="font-mono tabular-nums">{ultimo}</span>
        </div>
      )}
    </div>
  )
}
