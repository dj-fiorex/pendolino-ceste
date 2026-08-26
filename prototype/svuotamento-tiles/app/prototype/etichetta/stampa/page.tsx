"use client"
// PROTOTYPE (#31) — the single Etichetta at print proportions: 100 × 150 mm
// at 300 dpi = 1181 × 1772 px. Screenshot this route at exactly that viewport
// to get the PNG the preventivo shows.

import { Etichetta } from "@/components/prototype/screens/etichetta"
import { CODICE_ETICHETTA } from "@/components/prototype/screens/etichetta-screen"

export const PX_PER_MM_300DPI = 300 / 25.4

export default function Page() {
  return (
    <div className="min-h-svh bg-white">
      <Etichetta codice={CODICE_ETICHETTA} pxPerMm={PX_PER_MM_300DPI} />
    </div>
  )
}
