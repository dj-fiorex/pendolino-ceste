"use client"
// PROTOTYPE (#31) — one Cesta in a running list: prefix small, numero large,
// the Portata as a badge, and whatever control the screen puts at the end.

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { codiceOf } from "@/lib/prototype-data"

export function Codice({ numero, className }: { numero: number; className?: string }) {
  const [portata, forma, nnn] = codiceOf(numero).split("-")
  return (
    <span className={cn("font-mono tabular-nums", className)}>
      <span className="text-muted-foreground">
        {portata}-{forma}-
      </span>
      <span className="font-semibold">{nnn}</span>
    </span>
  )
}

export function CodiceRow({
  numero,
  children,
  className,
  onClick,
}: {
  numero: number
  children?: React.ReactNode
  className?: string
  onClick?: () => void
}) {
  const portata = codiceOf(numero).split("-")[0]
  const Tag = onClick ? "button" : "div"
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex h-14 w-full items-center gap-3 rounded-lg border bg-card px-3 text-left",
        className
      )}
    >
      <Codice numero={numero} className="text-2xl" />
      <Badge variant="secondary" className="tabular-nums">
        {portata} kg
      </Badge>
      <span className="ml-auto flex items-center gap-2">{children}</span>
    </Tag>
  )
}
