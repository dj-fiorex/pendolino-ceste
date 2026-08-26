"use client"
// PROTOTYPE (#31) — what every screen page reads from the URL: the variant
// (?variant=A|B|C), whether the switcher is hidden (?embed=1, the harness),
// and the theme (?tema=scuro|chiaro), forced so the harness and the
// screenshot run get the same picture regardless of the system setting.

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"

import { isVariantKey, type VariantKey } from "@/lib/variants"

export function useScreenParams() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { setTheme } = useTheme()

  const tema = params.get("tema")
  React.useEffect(() => {
    setTheme(tema === "scuro" ? "dark" : "light")
  }, [tema, setTheme])

  const raw = params.get("variant")
  const variant: VariantKey = isVariantKey(raw) ? raw : "A"

  const setVariant = React.useCallback(
    (key: VariantKey) => {
      const next = new URLSearchParams(params)
      next.set("variant", key)
      router.replace(`${pathname}?${next.toString()}`)
    },
    [params, pathname, router]
  )

  return { variant, setVariant, embed: params.get("embed") === "1" }
}
