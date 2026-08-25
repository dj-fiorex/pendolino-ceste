// PROTOTYPE (#30) — throwaway fake data for the Svuotamento tile screen.
// Nothing in this file is meant to land in the app.

export type Portata = 400 | 250
export type Forma = "Q" | "R"
export type Stato = "Disponibile" | "Fuori" | "Attesa molitura" | "Dismessa"

export type Cliente = { id: string; nome: string; alias: string[] }

export type Cesta = {
  numero: number
  portata: Portata
  forma: Forma
  codice: string
  stato: Stato
  clienteId?: string
  /** ISO date of the Rientro; present only while in Attesa molitura. */
  rientroAt?: string
}

/** A fixed "today" so the fake dates read the same on every run. */
export const TODAY = "2026-11-05"

export const CLIENTI: Cliente[] = [
  { id: "amato", nome: "Giuseppe Amato", alias: [] },
  { id: "russo", nome: "Salvatore Russo", alias: ["Turi", "u Zu Turi"] },
  { id: "greco", nome: "Antonio Greco", alias: ["Nino"] },
  { id: "costa", nome: "Maria Costa", alias: [] },
]

function portataOf(numero: number): Portata {
  return numero >= 171 ? 250 : 400
}

function formaOf(numero: number): Forma {
  return numero >= 171 || (numero >= 41 && numero <= 60) ? "Q" : "R"
}

export function codiceOf(numero: number) {
  return `${portataOf(numero)}-${formaOf(numero)}-${String(numero).padStart(3, "0")}`
}

/** [clienteId, rientroAt, numeri] — Amato has Ceste from two Rientri. */
const ATTESA: Array<[string, string, number[]]> = [
  ["amato", "2026-11-02", [17, 18, 22, 31, 45]],
  ["amato", "2026-11-04", [46, 171, 173]],
  ["russo", "2026-11-03", [3, 9, 58, 102, 175]],
  ["greco", "2026-11-04", [12, 60, 119]],
  ["costa", "2026-11-05", [87]],
]

const FUORI = [5, 6, 7, 8, 20, 21, 33, 34, 99, 100, 180, 181]
const DISMESSE = [150]

/** The whole fleet, numeri 1..195, most of it Disponibile. */
export function buildFleet(): Cesta[] {
  const fleet: Cesta[] = []
  for (let numero = 1; numero <= 195; numero++) {
    fleet.push({
      numero,
      portata: portataOf(numero),
      forma: formaOf(numero),
      codice: codiceOf(numero),
      stato: DISMESSE.includes(numero)
        ? "Dismessa"
        : FUORI.includes(numero)
          ? "Fuori"
          : "Disponibile",
    })
  }
  for (const [clienteId, rientroAt, numeri] of ATTESA) {
    for (const numero of numeri) {
      const cesta = fleet[numero - 1]
      cesta.stato = "Attesa molitura"
      cesta.clienteId = clienteId
      cesta.rientroAt = rientroAt
    }
  }
  return fleet
}

export function formatRientro(iso: string) {
  if (iso === TODAY) return "oggi"
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
  })
}
