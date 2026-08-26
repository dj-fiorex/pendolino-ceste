"use client"
// PROTOTYPE (#31) — the Ritiro picture's state, shared by its variants:
// Giuseppe Amato at the counter, four Ceste already scanned, three Fuori.

import * as React from "react"

import { clienteById, prestitoDi } from "@/lib/prototype-fuori"

const SCANSIONATE = [23, 24, 41, 172]

export function useRitiro() {
  const cliente = clienteById("amato")
  const prestito = prestitoDi("amato")
  const [lista, setLista] = React.useState<number[]>(SCANSIONATE)

  const add = React.useCallback(
    (numero: number) =>
      setLista((prev) => (prev.includes(numero) ? prev : [...prev, numero])),
    []
  )
  const remove = React.useCallback(
    (numero: number) => setLista((prev) => prev.filter((n) => n !== numero)),
    []
  )
  const confirm = React.useCallback(() => setLista([]), [])

  return { cliente, prestito, lista, ultimo: lista.at(-1), add, remove, confirm }
}
