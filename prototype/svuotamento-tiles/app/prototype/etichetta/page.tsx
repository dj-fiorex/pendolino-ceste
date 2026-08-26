"use client"
// PROTOTYPE (#31) — bare Etichette preview screen. ?tema=scuro for dark, ?embed=1 from the harness.

import * as React from "react"

import { EtichettaScreen } from "@/components/prototype/screens/etichetta-screen"
import { useTemaParam } from "@/components/prototype/screens/use-tema-param"

function Screen() {
  useTemaParam()
  return <EtichettaScreen />
}

export default function Page() {
  return (
    <React.Suspense>
      <Screen />
    </React.Suspense>
  )
}
