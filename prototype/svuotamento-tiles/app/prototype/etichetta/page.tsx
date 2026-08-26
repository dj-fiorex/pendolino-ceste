"use client"
// PROTOTYPE (#31) — the Etichette screen, three variants on ?variant=A|B|C.
// ?tema=scuro for dark, ?embed=1 hides the switcher (used by the harness).

import * as React from "react"

import { PrototypeSwitcher } from "@/components/prototype/switcher"
import { EtichettaB } from "@/components/prototype/screens/etichetta-b"
import { EtichettaC } from "@/components/prototype/screens/etichetta-c"
import { EtichettaScreen } from "@/components/prototype/screens/etichetta-screen"
import { useScreenParams } from "@/components/prototype/screens/use-screen-params"
import { SCREEN_VARIANTS } from "@/lib/variants"

function Screen() {
  const { variant, setVariant, embed } = useScreenParams()
  return (
    <>
      {variant === "A" && <EtichettaScreen />}
      {variant === "B" && <EtichettaB />}
      {variant === "C" && <EtichettaC />}
      {!embed && (
        <PrototypeSwitcher
          current={variant}
          onChange={setVariant}
          variants={SCREEN_VARIANTS.etichetta}
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
