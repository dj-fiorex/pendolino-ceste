"use client"
// PROTOTYPE (#30) — Variant C "Per Cliente 80": master/detail. A list of
// Clienti on the left (with the keypad under it on the tablet), the chosen
// Cliente's tiles at 80 px on the right. On the phone the list and the tiles
// are two steps.

import * as React from "react"
import { ArrowLeftIcon, ChevronRightIcon, HashIcon, InboxIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { ConfirmBar } from "@/components/prototype/confirm-bar"
import { Keypad } from "@/components/prototype/keypad"
import { Tile } from "@/components/prototype/tile"
import { formatRientro } from "@/lib/prototype-data"
import { cesteLabel, useSvuotamento } from "@/lib/use-svuotamento"

export const name = "Per Cliente 80"

export function VariantC() {
  const s = useSvuotamento()
  const [activeKey, setActiveKey] = React.useState<string | null>(null)
  const [detailOpen, setDetailOpen] = React.useState(false)

  const active =
    s.groups.find((g) => g.key === activeKey) ?? s.groups[0] ?? null

  function open(key: string) {
    setActiveKey(key)
    setDetailOpen(true)
  }

  const list = (
    <div className="flex flex-col">
      {s.groups.map((g) => {
        const selectedCount = g.ceste.filter((c) => s.isSelected(c.numero)).length
        const isActive = active?.key === g.key
        return (
          <Button
            key={g.key}
            variant={isActive ? "secondary" : "ghost"}
            onClick={() => open(g.key)}
            className="h-20 w-full justify-between rounded-none border-b px-4"
          >
            <span className="flex min-w-0 flex-col items-start gap-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-base font-semibold">{g.label}</span>
                {g.alias.map((a) => (
                  <Badge key={a} variant="outline">
                    {a}
                  </Badge>
                ))}
              </span>
              {g.oldest && (
                <span className="text-sm text-muted-foreground">
                  dal {formatRientro(g.oldest)}
                </span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <Badge variant={selectedCount > 0 ? "default" : "secondary"}>
                {selectedCount > 0
                  ? `${selectedCount} / ${g.ceste.length}`
                  : g.ceste.length}
              </Badge>
              <ChevronRightIcon />
            </span>
          </Button>
        )
      })}
    </div>
  )

  const detail = active ? (
    <div className="flex flex-col gap-4 p-3 md:p-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-lg"
          className="size-12 md:hidden"
          onClick={() => setDetailOpen(false)}
        >
          <ArrowLeftIcon />
          <span className="sr-only">Torna all&apos;elenco</span>
        </Button>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2">
            <span className="truncate text-lg font-semibold">{active.label}</span>
            {active.alias.map((a) => (
              <Badge key={a} variant="outline">
                {a}
              </Badge>
            ))}
          </span>
          <span className="text-sm text-muted-foreground">
            {cesteLabel(active.ceste.length)}
            {active.oldest && ` · dal ${formatRientro(active.oldest)}`}
          </span>
        </div>
        <Button
          variant={s.groupState(active.key) === "all" ? "default" : "outline"}
          className="h-14 px-5 text-base"
          onClick={() => s.toggleGroup(active.key)}
        >
          {s.groupState(active.key) === "all" ? "Nessuna" : "Seleziona tutte"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-3">
        {active.ceste.map((c) => (
          <Tile
            key={c.numero}
            cesta={c}
            size={80}
            selected={s.isSelected(c.numero)}
            onToggle={() => s.toggle(c.numero)}
          />
        ))}
      </div>
    </div>
  ) : null

  const empty = (
    <Empty className="m-4">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon />
        </EmptyMedia>
        <EmptyTitle>Nessuna Cesta in attesa di molitura</EmptyTitle>
        <EmptyDescription>Le Ceste compaiono qui al Rientro.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )

  return (
    <div className="flex min-h-svh flex-col pb-28 md:grid md:grid-cols-[22rem_1fr]">
      <div
        className={cn(
          "flex flex-col md:border-r",
          detailOpen && "hidden md:flex"
        )}
      >
        <h1 className="p-4 font-heading text-lg font-medium">Svuotamento</h1>
        {s.groups.length === 0 ? empty : list}
        <Separator className="mt-auto hidden md:block" />
        <div className="hidden flex-col gap-2 p-4 md:flex">
          <h2 className="text-sm font-medium text-muted-foreground">
            Aggiungi per numero
          </h2>
          <Keypad onAdd={s.addByNumero} keyClass="h-14 text-xl" />
        </div>
      </div>
      <div className={cn("min-w-0", !detailOpen && "hidden md:block")}>
        {s.groups.length === 0 ? empty : detail}
      </div>

      <ConfirmBar count={s.selectedCount} onConfirm={s.confirm}>
        <Drawer>
          <DrawerTrigger
            render={<Button variant="outline" className="size-16 md:hidden" />}
          >
            <HashIcon />
            <span className="sr-only">Aggiungi per numero</span>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Aggiungi per numero</DrawerTitle>
            </DrawerHeader>
            <Keypad onAdd={s.addByNumero} className="p-4" />
          </DrawerContent>
        </Drawer>
      </ConfirmBar>
    </div>
  )
}
