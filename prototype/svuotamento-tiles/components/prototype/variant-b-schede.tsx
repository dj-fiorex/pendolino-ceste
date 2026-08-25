"use client"
// PROTOTYPE (#30) — Variant B "Schede 96": one Card per Cliente, 96 px tiles,
// two card columns on the tablet, keypad always in a Dialog opened from a
// large key beside the confirm button.

import * as React from "react"
import { HashIcon, InboxIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { useSvuotamento } from "@/lib/use-svuotamento"

export const name = "Schede 96"

export function VariantB() {
  const s = useSvuotamento()

  return (
    <div className="flex min-h-svh flex-col gap-4 p-3 pb-28 md:p-4">
      <h1 className="font-heading text-lg font-medium">Svuotamento</h1>
      {s.groups.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InboxIcon />
            </EmptyMedia>
            <EmptyTitle>Nessuna Cesta in attesa di molitura</EmptyTitle>
            <EmptyDescription>Le Ceste compaiono qui al Rientro.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {s.groups.map((g) => {
            const state = s.groupState(g.key)
            return (
              <Card key={g.key}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                    {g.label}
                    {g.alias.map((a) => (
                      <Badge key={a} variant="secondary">
                        {a}
                      </Badge>
                    ))}
                  </CardTitle>
                  <CardDescription>
                    {g.ceste.length} Ceste
                    {g.oldest && ` · dal ${formatRientro(g.oldest)}`}
                  </CardDescription>
                  <CardAction>
                    <Button
                      variant={state === "all" ? "default" : "outline"}
                      aria-pressed={state === "all"}
                      className="h-12 px-4 text-base"
                      onClick={() => s.toggleGroup(g.key)}
                    >
                      {state === "all" ? "Nessuna" : "Tutte"}
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {g.ceste.map((c) => (
                    <Tile
                      key={c.numero}
                      cesta={c}
                      size={96}
                      selected={s.isSelected(c.numero)}
                      onToggle={() => s.toggle(c.numero)}
                    />
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmBar count={s.selectedCount} onConfirm={s.confirm}>
        <Dialog>
          <DialogTrigger
            render={<Button variant="outline" className="h-16 px-5 text-lg" />}
          >
            <HashIcon data-icon="inline-start" />
            Numero
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aggiungi per numero</DialogTitle>
            </DialogHeader>
            <Keypad onAdd={s.addByNumero} keyClass="h-20 text-3xl" />
          </DialogContent>
        </Dialog>
      </ConfirmBar>
    </div>
  )
}
