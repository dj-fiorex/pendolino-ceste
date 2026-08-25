"use client"
// PROTOTYPE (#30) — in-memory Svuotamento state shared by every variant.
// Selection, grouping by Cliente, keypad lookups and the confirm step.

import * as React from "react"

import { beep } from "@/lib/beep"
import {
  buildFleet,
  CLIENTI,
  type Cesta,
  type Cliente,
} from "@/lib/prototype-data"

export type Gruppo = {
  key: string
  cliente: Cliente | null
  label: string
  alias: string[]
  ceste: Cesta[]
  /** Oldest Rientro in the group; absent for the keypad group. */
  oldest?: string
}

export type AddResult = { ok: boolean; message: string }

export const MANUAL_KEY = "tastierino"

export function useSvuotamento() {
  const [fleet, setFleet] = React.useState<Cesta[]>(buildFleet)
  const [selected, setSelected] = React.useState<Set<number>>(() => new Set())
  // Numeri typed on the keypad that the app does not believe to be in
  // Attesa molitura. They get their own group at the top.
  const [manual, setManual] = React.useState<number[]>([])

  const groups = React.useMemo<Gruppo[]>(() => {
    const byCliente = new Map<string, Cesta[]>()
    for (const cesta of fleet) {
      if (cesta.stato !== "Attesa molitura" || !cesta.clienteId) continue
      const list = byCliente.get(cesta.clienteId) ?? []
      list.push(cesta)
      byCliente.set(cesta.clienteId, list)
    }
    const result: Gruppo[] = []
    for (const [clienteId, ceste] of byCliente) {
      const cliente = CLIENTI.find((c) => c.id === clienteId)!
      ceste.sort((a, b) => a.numero - b.numero)
      const oldest = ceste
        .map((c) => c.rientroAt!)
        .sort()
        .at(0)
      result.push({
        key: clienteId,
        cliente,
        label: cliente.nome,
        alias: cliente.alias,
        ceste,
        oldest,
      })
    }
    result.sort((a, b) => a.oldest!.localeCompare(b.oldest!))
    if (manual.length > 0) {
      result.unshift({
        key: MANUAL_KEY,
        cliente: null,
        label: "Aggiunte dal tastierino",
        alias: [],
        ceste: manual
          .map((n) => fleet[n - 1])
          .sort((a, b) => a.numero - b.numero),
      })
    }
    return result
  }, [fleet, manual])

  const isSelected = React.useCallback(
    (numero: number) => selected.has(numero),
    [selected]
  )

  const toggle = React.useCallback((numero: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(numero)) next.delete(numero)
      else next.add(numero)
      return next
    })
  }, [])

  const groupState = React.useCallback(
    (key: string): "none" | "some" | "all" => {
      const group = groups.find((g) => g.key === key)
      if (!group) return "none"
      const count = group.ceste.filter((c) => selected.has(c.numero)).length
      if (count === 0) return "none"
      return count === group.ceste.length ? "all" : "some"
    },
    [groups, selected]
  )

  const toggleGroup = React.useCallback(
    (key: string) => {
      const group = groups.find((g) => g.key === key)
      if (!group) return
      const all = group.ceste.every((c) => selected.has(c.numero))
      setSelected((prev) => {
        const next = new Set(prev)
        for (const c of group.ceste) {
          if (all) next.delete(c.numero)
          else next.add(c.numero)
        }
        return next
      })
    },
    [groups, selected]
  )

  const addByNumero = React.useCallback(
    (numero: number): AddResult => {
      const cesta = fleet[numero - 1]
      if (!cesta) {
        return { ok: false, message: `Nessuna Cesta con numero ${numero}` }
      }
      setSelected((prev) => new Set(prev).add(numero))
      if (cesta.stato === "Attesa molitura") {
        return { ok: true, message: `${cesta.codice} selezionata` }
      }
      setManual((prev) => (prev.includes(numero) ? prev : [...prev, numero]))
      return {
        ok: true,
        message: `${cesta.codice} risulta ${cesta.stato}: verrà svuotata con una Rettifica`,
      }
    },
    [fleet]
  )

  const confirm = React.useCallback(() => {
    const count = selected.size
    if (count === 0) return 0
    setFleet((prev) =>
      prev.map((c) =>
        selected.has(c.numero)
          ? { ...c, stato: "Disponibile", clienteId: undefined, rientroAt: undefined }
          : c
      )
    )
    setManual([])
    setSelected(new Set())
    beep()
    return count
  }, [selected])

  return {
    groups,
    selectedCount: selected.size,
    isSelected,
    toggle,
    groupState,
    toggleGroup,
    addByNumero,
    confirm,
  }
}

export function confirmLabel(count: number) {
  return count === 1 ? "Svuota 1 Cesta" : `Svuota ${count} Ceste`
}

export function cesteLabel(count: number) {
  return count === 1 ? "1 Cesta" : `${count} Ceste`
}
