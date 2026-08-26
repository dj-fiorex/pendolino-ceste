"use client"
// PROTOTYPE (#31) — bare Rientro screen. ?tema=scuro for dark, ?embed=1 from the harness.

import * as React from "react"

import { RientroScreen } from "@/components/prototype/screens/rientro-screen"
import { useTemaParam } from "@/components/prototype/screens/use-tema-param"

function Screen() {
  useTemaParam()
  return <RientroScreen />
}

export default function Page() {
  return (
    <React.Suspense>
      <Screen />
    </React.Suspense>
  )
}
