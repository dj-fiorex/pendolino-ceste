"use client"
// PROTOTYPE (#31) — bare recovery list. ?tema=scuro for dark, ?embed=1 from the harness.

import * as React from "react"

import { RecuperoScreen } from "@/components/prototype/screens/recupero-screen"
import { useTemaParam } from "@/components/prototype/screens/use-tema-param"

function Screen() {
  useTemaParam()
  return <RecuperoScreen />
}

export default function Page() {
  return (
    <React.Suspense>
      <Screen />
    </React.Suspense>
  )
}
