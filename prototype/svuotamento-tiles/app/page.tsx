"use client"
// PROTOTYPE (#30, #31) — harness: one prototype screen inside a phone or
// tablet frame. The Svuotamento keeps its three variants and the switcher;
// the #31 screens (Ritiro, recupero, Etichetta, Rientro) are single takes for
// the preventivo. Open /prototype/<screen> for the bare screen.

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ExternalLinkIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  isVariantKey,
  PrototypeSwitcher,
  type VariantKey,
} from "@/components/prototype/switcher"

const DEVICES = {
  phone: { label: "Telefono 390 × 844", width: 390, height: 844 },
  tablet: { label: "Tablet 1180 × 820", width: 1180, height: 820 },
} as const

type DeviceKey = keyof typeof DEVICES

const SCREENS = {
  svuotamento: { label: "Svuotamento", variants: true },
  ritiro: { label: "Ritiro", variants: false },
  recupero: { label: "Recupero", variants: false },
  etichetta: { label: "Etichetta", variants: false },
  rientro: { label: "Rientro", variants: false },
} as const

type ScreenKey = keyof typeof SCREENS

function isScreenKey(value: string | null): value is ScreenKey {
  return value !== null && value in SCREENS
}

function Harness() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const rawScreen = params.get("screen")
  const screen: ScreenKey = isScreenKey(rawScreen) ? rawScreen : "svuotamento"
  const rawVariant = params.get("variant")
  const variant: VariantKey = isVariantKey(rawVariant) ? rawVariant : "A"
  const rawDevice = params.get("device")
  const device: DeviceKey = rawDevice === "tablet" ? "tablet" : "phone"
  const tema = params.get("tema") === "scuro" ? "scuro" : "chiaro"

  const set = React.useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(params)
      for (const [k, v] of Object.entries(patch)) next.set(k, v)
      router.replace(`${pathname}?${next.toString()}`)
    },
    [params, pathname, router]
  )

  const { width, height } = DEVICES[device]
  const query = new URLSearchParams({ tema })
  if (SCREENS[screen].variants) query.set("variant", variant)
  const bare = `/prototype/${screen}?${query.toString()}`
  const src = `${bare}&embed=1`

  return (
    <div className="flex min-h-svh flex-col gap-4 bg-muted p-4 pt-14">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          value={[screen]}
          onValueChange={(v) => v[0] && set({ screen: String(v[0]) })}
          variant="outline"
        >
          {Object.entries(SCREENS).map(([key, s]) => (
            <ToggleGroupItem key={key} value={key}>
              {s.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup
          value={[device]}
          onValueChange={(v) => v[0] && set({ device: String(v[0]) })}
          variant="outline"
        >
          {Object.entries(DEVICES).map(([key, d]) => (
            <ToggleGroupItem key={key} value={key}>
              {d.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup
          value={[tema]}
          onValueChange={(v) => v[0] && set({ tema: String(v[0]) })}
          variant="outline"
        >
          <ToggleGroupItem value="chiaro">Chiaro</ToggleGroupItem>
          <ToggleGroupItem value="scuro">Scuro</ToggleGroupItem>
        </ToggleGroup>
        <Button
          variant="link"
          render={<a href={bare} target="_blank" />}
          nativeButton={false}
        >
          <ExternalLinkIcon data-icon="inline-start" />
          Apri a schermo intero
        </Button>
        <span className="text-sm text-muted-foreground">
          stato in memoria, si azzera al cambio
          {SCREENS[screen].variants && " · ← → cambiano variante"}
        </span>
      </div>
      <div className="overflow-auto">
        <iframe
          key={`${screen}-${variant}-${device}-${tema}`}
          src={src}
          title={`${SCREENS[screen].label}, ${DEVICES[device].label}`}
          width={width}
          height={height}
          className="shrink-0 rounded-2xl border bg-background shadow-xl"
          style={{ width, height }}
        />
      </div>
      {SCREENS[screen].variants && (
        <PrototypeSwitcher current={variant} onChange={(key) => set({ variant: key })} />
      )}
    </div>
  )
}

export default function Page() {
  return (
    <React.Suspense>
      <Harness />
    </React.Suspense>
  )
}
