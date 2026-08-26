"use client"
// PROTOTYPE (#31) — the Rientro picture's state, shared by its variants:
// 400-R-003 scanned, Salvatore Russo identified, four of five on the trailer.
// A numero typed that is not his goes through anyway, with a Rettifica
// (ADR-0005), and joins the list flagged as such.

import * as React from "react"

import { codiceOf } from "@/lib/prototype-data"
import { clienteById, prestitoDi } from "@/lib/prototype-fuori"
import type { AddResult } from "@/lib/use-svuotamento"

export const SCANSIONATA = 3
const RESTA_FUORI = 175

export function useRientro() {
  const cliente = clienteById("russo")
  const prestito = prestitoDi("russo")
  const [spuntate, setSpuntate] = React.useState<Set<number>>(
    () => new Set(prestito.numeri.filter((n) => n !== RESTA_FUORI))
  )
  /** Numeri typed on the keypad that the app does not believe to be his. */
  const [rettifiche, setRettifiche] = React.useState<number[]>([])

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

  const addByNumero = React.useCallback(
    (numero: number): AddResult => {
      if (numero < 1 || numero > 195) {
        return { ok: false, message: `Nessuna Cesta con numero ${numero}` }
      }
      const codice = codiceOf(numero)
      setSpuntate((prev) => new Set(prev).add(numero))
      if (prestito.numeri.includes(numero)) {
        return { ok: true, message: `${codice} spuntata` }
      }
      setRettifiche((prev) => (prev.includes(numero) ? prev : [...prev, numero]))
      return {
        ok: true,
        message: `${codice} non risulta di ${cliente.nome}: rientra con una Rettifica`,
      }
    },
    [prestito.numeri, cliente.nome]
  )

  const confirm = React.useCallback(() => {
    setSpuntate(new Set())
    setRettifiche([])
  }, [])

  const rientrano = [...prestito.numeri.filter((n) => spuntate.has(n)), ...rettifiche.filter((n) => spuntate.has(n))]
  const restano = prestito.numeri.filter((n) => !spuntate.has(n))

  return {
    cliente,
    prestito,
    spuntate,
    rettifiche,
    rientrano,
    restano,
    toggle,
    addByNumero,
    confirm,
  }
}
