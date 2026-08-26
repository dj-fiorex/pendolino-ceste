"use client"
// PROTOTYPE (#31) — the Ritiro picture's state, shared by its variants:
// Giuseppe Amato at the counter, four Ceste already scanned, three Fuori.

import * as React from "react"

import { codiceOf } from "@/lib/prototype-data"
import { clienteById, prestitoDi } from "@/lib/prototype-fuori"
import type { AddResult } from "@/lib/use-svuotamento"

const SCANSIONATE = [23, 24, 41, 172]

export function useRitiro() {
  const cliente = clienteById("amato")
  const prestito = prestitoDi("amato")
  const [lista, setLista] = React.useState<number[]>(SCANSIONATE)

  const add = React.useCallback(
    (numero: number): AddResult => {
      if (numero < 1 || numero > 195) {
        return { ok: false, message: `Nessuna Cesta con numero ${numero}` }
      }
      const codice = codiceOf(numero)
      if (lista.includes(numero)) {
        return { ok: true, message: `${codice} è già nel Ritiro` }
      }
      setLista((prev) => [...prev, numero])
      return { ok: true, message: `${codice} aggiunta al Ritiro` }
    },
    [lista]
  )
  const remove = React.useCallback(
    (numero: number) => setLista((prev) => prev.filter((n) => n !== numero)),
    []
  )
  const confirm = React.useCallback(() => setLista([]), [])

  return { cliente, prestito, lista, ultimo: lista.at(-1), add, remove, confirm }
}
