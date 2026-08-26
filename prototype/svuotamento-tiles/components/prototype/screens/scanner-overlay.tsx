"use client"
// PROTOTYPE (#31) — variant C's header: the camera runs edge to edge across
// the top with the title laid over it, so nothing on the page competes with
// the viewfinder. Manual entry is the "Numero" key in the bottom bar.

import { Viewfinder } from "@/components/prototype/screens/viewfinder"

export function ScannerOverlay({
  ultimo,
  title,
  action,
}: {
  ultimo?: string
  title: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <Viewfinder
      ultimo={ultimo}
      caption={false}
      frameClass="inset-x-[22%] top-[30%] bottom-[22%] md:inset-x-[32%]"
      className="h-64 rounded-none md:h-72 md:rounded-b-2xl"
    >
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-linear-to-b from-black/70 to-transparent p-3 pb-8 text-white">
        <div className="min-w-0 flex-1">{title}</div>
        {action}
      </div>
    </Viewfinder>
  )
}
