"use client"
// PROTOTYPE (#31) — the Rientro picture's state, shared by its variants:
// 400-R-003 scanned, Salvatore Russo identified, four of five on the trailer.

import * as React from "react"

import { clienteById, prestitoDi } from "@/lib/prototype-fuori"

export const SCANSIONATA = 3
const RESTA_FUORI = 175

export function useRientro() {
  const cliente = clienteById("russo")
  const prestito = prestitoDi("russo")
  const [spuntate, setSpuntate] = React.useState<Set<number>>(
    () => new Set(prestito.numeri.filter((n) => n !== RESTA_FUORI))
  )

  const toggle = React.useCallback(
    (n: number) =>
      setSpuntate((prev) => {
        const next = new Set(prev)
        if (next.has(n)) next.delete(n)
        else next.add(n)
        return next
      }),
    []
  )
  const confirm = React.useCallback(() => setSpuntate(new Set()), [])

  const rientrano = prestito.numeri.filter((n) => spuntate.has(n))
  const restano = prestito.numeri.filter((n) => !spuntate.has(n))

  return { cliente, prestito, spuntate, rientrano, restano, toggle, confirm }
}
