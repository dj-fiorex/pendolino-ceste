"use client"
// PROTOTYPE (#31) — the recovery list, three variants on ?variant=A|B|C.
// ?tema=scuro for dark, ?embed=1 hides the switcher (used by the harness).

import * as React from "react"

import { PrototypeSwitcher } from "@/components/prototype/switcher"
import { RecuperoB } from "@/components/prototype/screens/recupero-b"
import { RecuperoC } from "@/components/prototype/screens/recupero-c"
import { RecuperoScreen } from "@/components/prototype/screens/recupero-screen"
import { useScreenParams } from "@/components/prototype/screens/use-screen-params"
import { SCREEN_VARIANTS } from "@/lib/variants"

function Screen() {
  const { variant, setVariant, embed } = useScreenParams()
  return (
    <>
      {variant === "A" && <RecuperoScreen />}
      {variant === "B" && <RecuperoB />}
      {variant === "C" && <RecuperoC />}
      {!embed && (
        <PrototypeSwitcher
          current={variant}
          onChange={setVariant}
          variants={SCREEN_VARIANTS.recupero}
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
