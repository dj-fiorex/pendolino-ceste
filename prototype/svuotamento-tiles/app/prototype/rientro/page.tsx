"use client"
// PROTOTYPE (#31) — the Rientro screen, three variants on ?variant=A|B|C.
// ?tema=scuro for dark, ?embed=1 hides the switcher (used by the harness).

import * as React from "react"

import { PrototypeSwitcher } from "@/components/prototype/switcher"
import { RientroB } from "@/components/prototype/screens/rientro-b"
import { RientroC } from "@/components/prototype/screens/rientro-c"
import { RientroScreen } from "@/components/prototype/screens/rientro-screen"
import { useScreenParams } from "@/components/prototype/screens/use-screen-params"
import { SCREEN_VARIANTS } from "@/lib/variants"

function Screen() {
  const { variant, setVariant, embed } = useScreenParams()
  return (
    <>
      {variant === "A" && <RientroScreen />}
      {variant === "B" && <RientroB />}
      {variant === "C" && <RientroC />}
      {!embed && (
        <PrototypeSwitcher
          current={variant}
          onChange={setVariant}
          variants={SCREEN_VARIANTS.rientro}
        />
      )}
    </>
  )
}

export default function Page() {
  return (
    <React.Suspense>
      <Screen />
    </React.Suspense>
  )
}
