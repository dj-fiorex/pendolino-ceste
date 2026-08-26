// PROTOTYPE (#31) — throwaway fake data for the Ritiro, recupero and Rientro
// pictures: who holds which Ceste Fuori, since when, and their telefono.
// Same Clienti and Codici as #30 so the screenshots read as one app; two
// extra Clienti pad the recovery list. Nothing here is meant to land in the app.

import { CLIENTI, codiceOf, TODAY, type Cliente } from "@/lib/prototype-data"

export type ClienteFuori = Cliente & { telefono?: string }

export const CLIENTI_FUORI: ClienteFuori[] = [
  { ...CLIENTI[0], telefono: "333 123 4567" },
  { ...CLIENTI[1], telefono: "347 234 5678" },
  { ...CLIENTI[2], telefono: "339 345 6789" },
  { ...CLIENTI[3] }, // Maria Costa never gave a telefono.
  {
    id: "lopiccolo",
    nome: "Francesco Lo Piccolo",
    alias: ["Ciccio"],
    telefono: "320 456 7890",
  },
  { id: "vitale", nome: "Rosa Vitale", alias: [], telefono: "328 567 8901" },
]

/** One Ritiro still open: the Ceste it took out and the day it happened. */
export type Prestito = { clienteId: string; ritiroAt: string; numeri: number[] }

export const PRESTITI: Prestito[] = [
  { clienteId: "amato", ritiroAt: "2026-11-02", numeri: [17, 18, 22] },
  { clienteId: "russo", ritiroAt: "2026-10-25", numeri: [3, 9, 58, 102, 175] },
  { clienteId: "greco", ritiroAt: "2026-10-15", numeri: [12, 60] },
  { clienteId: "costa", ritiroAt: "2026-10-29", numeri: [87, 88, 89, 90] },
  {
    clienteId: "lopiccolo",
    ritiroAt: "2026-10-20",
    numeri: [33, 34, 99, 100, 180, 181],
  },
  { clienteId: "vitale", ritiroAt: "2026-11-04", numeri: [5] },
]

/** The Admin's late threshold, in days Fuori. Highlighting only. */
export const SOGLIA_RITARDO = 10

/** Mill details as they would appear on the Etichetta. Fake. */
export const FRANTOIO = { nome: "Frantoio Pendolino", telefono: "0931 000 000" }

function toDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function giorniFuori(ritiroAt: string) {
  const ms = toDate(TODAY).getTime() - toDate(ritiroAt).getTime()
  return Math.round(ms / 86_400_000)
}

export function formatGiorno(iso: string) {
  return toDate(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" })
}

export function clienteById(id: string) {
  return CLIENTI_FUORI.find((c) => c.id === id)!
}

export function prestitoDi(clienteId: string) {
  return PRESTITI.find((p) => p.clienteId === clienteId)!
}

export function codici(numeri: number[]) {
  return numeri.map(codiceOf)
}

export function giorniLabel(n: number) {
  return n === 1 ? "1 giorno" : `${n} giorni`
}
