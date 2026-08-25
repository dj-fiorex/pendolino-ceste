"use client"
// PROTOTYPE (#30) — the Svuotamento tile screen, three variants switchable
// via ?variant=A|B|C. ?embed=1 hides the switcher (used by the harness).

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import {
  isVariantKey,
  PrototypeSwitcher,
  type VariantKey,
} from "@/components/prototype/switcher"
import { VariantA } from "@/components/prototype/variant-a-griglia"
import { VariantB } from "@/components/prototype/variant-b-schede"
import { VariantC } from "@/components/prototype/variant-c-per-cliente"

function Screen() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const raw = params.get("variant")
  const variant: VariantKey = isVariantKey(raw) ? raw : "A"
  const embed = params.get("embed") === "1"

  const setVariant = React.useCallback(
    (key: VariantKey) => {
      const next = new URLSearchParams(params)
      next.set("variant", key)
      router.replace(`${pathname}?${next.toString()}`)
    },
    [params, pathname, router]
  )

  return (
    <>
      {variant === "A" && <VariantA />}
      {variant === "B" && <VariantB />}
      {variant === "C" && <VariantC />}
      {!embed && <PrototypeSwitcher current={variant} onChange={setVariant} />}
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
