"use client"
// PROTOTYPE (#30) — Variant A "Griglia 64": the #18 layout as written.
// Full-width group header bars, 64 px tiles wrapping under each, keypad in a
// side column on the tablet and in a bottom Drawer on the phone.

import * as React from "react"
import { HashIcon, InboxIcon, SquareCheckIcon, SquareIcon } from "lucide-react"

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
import { ConfirmBar } from "@/components/prototype/confirm-bar"
import { Keypad } from "@/components/prototype/keypad"
import { Tile } from "@/components/prototype/tile"
import { formatRientro } from "@/lib/prototype-data"
import { cesteLabel, useSvuotamento } from "@/lib/use-svuotamento"

export const name = "Griglia 64"

export function VariantA() {
  const s = useSvuotamento()

  return (
    <div className="flex min-h-svh">
      <main className="flex min-w-0 flex-1 flex-col gap-5 p-3 pb-28 md:p-4">
        <h1 className="font-heading text-lg font-medium">Svuotamento</h1>
        {s.groups.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <InboxIcon />
              </EmptyMedia>
              <EmptyTitle>Nessuna Cesta in attesa di molitura</EmptyTitle>
              <EmptyDescription>
                Le Ceste compaiono qui al Rientro.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          s.groups.map((g) => {
            const state = s.groupState(g.key)
            return (
              <section key={g.key} className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  aria-pressed={state === "all"}
                  onClick={() => s.toggleGroup(g.key)}
                  className="h-16 w-full justify-between px-4"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-base font-semibold">
                      {g.label}
                    </span>
                    {g.alias.map((a) => (
                      <Badge key={a} variant="outline">
                        {a}
                      </Badge>
                    ))}
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                    <span>{cesteLabel(g.ceste.length)}</span>
                    {g.oldest && <span>dal {formatRientro(g.oldest)}</span>}
                    {state === "all" ? <SquareCheckIcon /> : <SquareIcon />}
                  </span>
                </Button>
                <div className="flex flex-wrap gap-2">
                  {g.ceste.map((c) => (
                    <Tile
                      key={c.numero}
                      cesta={c}
                      size={64}
                      selected={s.isSelected(c.numero)}
                      onToggle={() => s.toggle(c.numero)}
                    />
                  ))}
                </div>
              </section>
            )
          })
        )}
      </main>

      <aside className="hidden w-80 shrink-0 flex-col gap-3 border-l p-4 pb-28 md:flex">
        <h2 className="font-heading text-base font-medium">Aggiungi per numero</h2>
        <Keypad onAdd={s.addByNumero} />
      </aside>

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
