"use client"
// PROTOTYPE (#30) — harness: the Svuotamento screen inside a phone or tablet
// frame, with the variant switcher. Open /prototype/svuotamento for the bare
// screen at the window's own size.

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

function Harness() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const rawVariant = params.get("variant")
  const variant: VariantKey = isVariantKey(rawVariant) ? rawVariant : "A"
  const rawDevice = params.get("device")
  const device: DeviceKey = rawDevice === "tablet" ? "tablet" : "phone"

  const set = React.useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(params)
      for (const [k, v] of Object.entries(patch)) next.set(k, v)
      router.replace(`${pathname}?${next.toString()}`)
    },
    [params, pathname, router]
  )

  const { width, height } = DEVICES[device]
  const src = `/prototype/svuotamento?variant=${variant}&embed=1`

  return (
    <div className="flex min-h-svh flex-col gap-4 bg-muted p-4 pt-14">
      <div className="flex flex-wrap items-center gap-3">
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
        <Button
          variant="link"
          render={<a href={src.replace("&embed=1", "")} target="_blank" />}
          nativeButton={false}
        >
          <ExternalLinkIcon data-icon="inline-start" />
          Apri a schermo intero
        </Button>
        <span className="text-sm text-muted-foreground">
          ← → cambiano variante · stato in memoria, si azzera al cambio
        </span>
      </div>
      <div className="overflow-auto">
        <iframe
          key={`${variant}-${device}`}
          src={src}
          title={`Svuotamento — variante ${variant}, ${DEVICES[device].label}`}
          width={width}
          height={height}
          className="shrink-0 rounded-2xl border bg-background shadow-xl"
          style={{ width, height }}
        />
      </div>
      <PrototypeSwitcher current={variant} onChange={(key) => set({ variant: key })} />
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
