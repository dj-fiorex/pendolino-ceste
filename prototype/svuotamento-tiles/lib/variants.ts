// PROTOTYPE (#30, #31) — the three variants of every screen, by screen key.
// Keys are always A|B|C so ?variant= is shareable across screens.

export type VariantKey = "A" | "B" | "C"
export type Variant = { key: VariantKey; name: string }

export const SCREEN_VARIANTS = {
  svuotamento: [
    { key: "A", name: "Griglia 64" },
    { key: "B", name: "Schede 96" },
    { key: "C", name: "Per Cliente 80" },
  ],
  ritiro: [
    { key: "A", name: "Scanner in alto" },
    { key: "B", name: "Tessere, scanner in basso" },
    { key: "C", name: "Camera a tutta larghezza" },
  ],
  recupero: [
    { key: "A", name: "Schede" },
    { key: "B", name: "Tabella" },
    { key: "C", name: "Per fascia di giorni" },
  ],
  etichetta: [
    { key: "A", name: "Pagina" },
    { key: "B", name: "Foglio e impostazioni" },
    { key: "C", name: "Elenco e anteprima" },
  ],
  rientro: [
    { key: "A", name: "Elenco spuntato" },
    { key: "B", name: "Tessere, scanner in basso" },
    { key: "C", name: "Rientrano / Restano" },
  ],
} as const satisfies Record<string, readonly Variant[]>

export type ScreenKey = keyof typeof SCREEN_VARIANTS

export function isVariantKey(value: string | null): value is VariantKey {
  return value === "A" || value === "B" || value === "C"
}
