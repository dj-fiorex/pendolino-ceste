"use client"
// PROTOTYPE (#31) — variant C's header: the camera runs edge to edge across
// the top with the title and the numero field laid over it, so nothing on
// the page competes with the viewfinder. Scrims keep the overlays legible.

import { NumeroField } from "@/components/prototype/screens/numero-field"
import { Viewfinder } from "@/components/prototype/screens/viewfinder"

export function ScannerOverlay({
  ultimo,
  onAdd,
  title,
  action,
}: {
  ultimo?: string
  onAdd: (numero: number) => void
  title: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <Viewfinder
      ultimo={ultimo}
      caption={false}
      frameClass="inset-x-[22%] top-[28%] bottom-[38%] md:inset-x-[30%]"
      className="h-72 rounded-none md:h-80 md:rounded-b-2xl"
    >
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-linear-to-b from-black/70 to-transparent p-3 pb-8 text-white">
        <div className="min-w-0 flex-1">{title}</div>
        {action}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-3 pt-10">
        <NumeroField onAdd={onAdd} compact className="mx-auto max-w-md" />
      </div>
    </Viewfinder>
  )
}
