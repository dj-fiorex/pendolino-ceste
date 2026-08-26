"use client"
// PROTOTYPE (#31) — force the theme from the URL so the harness and the
// screenshot run get the same picture regardless of the system setting.
// ?tema=scuro → dark, ?tema=chiaro (or absent) → light.

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { useTheme } from "next-themes"

export function useTemaParam() {
  const params = useSearchParams()
  const { setTheme } = useTheme()
  const tema = params.get("tema")
  React.useEffect(() => {
    setTheme(tema === "scuro" ? "dark" : "light")
  }, [tema, setTheme])
  return { embed: params.get("embed") === "1" }
}
