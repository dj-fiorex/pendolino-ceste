"use client"
// PROTOTYPE (#31) — bare Ritiro screen. ?tema=scuro for dark, ?embed=1 from the harness.

import * as React from "react"

import { RitiroScreen } from "@/components/prototype/screens/ritiro-screen"
import { useTemaParam } from "@/components/prototype/screens/use-tema-param"

function Screen() {
  useTemaParam()
  return <RitiroScreen />
}

export default function Page() {
  return (
    <React.Suspense>
      <Screen />
    </React.Suspense>
  )
}
