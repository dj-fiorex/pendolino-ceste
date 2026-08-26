"use client"
// PROTOTYPE (#31) — one Etichetta as it will be printed (#29, ADR-0007).
// Label size assumed 100 × 150 mm (nothing in #1 fixes it yet). Everything is
// laid out in millimetres through --mm, the px-per-mm scale, so the same
// component is the on-screen preview and the print-proportion PNG.

import { QRCodeSVG } from "qrcode.react"

import { FRANTOIO } from "@/lib/prototype-fuori"

export const ETICHETTA_MM = { width: 100, height: 150 }

function mm(n: number) {
  return `calc(var(--mm) * ${n})`
}

export function Etichetta({
  codice,
  pxPerMm,
  nome = true,
  telefono = true,
}: {
  codice: string
  pxPerMm: number
  /** The Admin settings: mill's name and phone on the label. */
  nome?: boolean
  telefono?: boolean
}) {
  const [portata, forma, numero] = codice.split("-")
  const qr = 52

  return (
    <div
      style={
        {
          "--mm": `${pxPerMm}px`,
          width: mm(ETICHETTA_MM.width),
          height: mm(ETICHETTA_MM.height),
          padding: mm(7),
        } as React.CSSProperties
      }
      className="flex shrink-0 flex-col items-center justify-between bg-white font-sans text-black"
    >
      <div className="flex flex-col items-center" style={{ gap: mm(1) }}>
        <span
          className="leading-none font-medium tracking-wide tabular-nums"
          style={{ fontSize: mm(11) }}
        >
          {portata}-{forma}
        </span>
        <span
          className="leading-none font-bold tabular-nums"
          style={{ fontSize: mm(34), letterSpacing: mm(-0.5) }}
        >
          {numero}
        </span>
      </div>
      <QRCodeSVG
        value={codice}
        level="H"
        marginSize={0}
        style={{ width: mm(qr), height: mm(qr) }}
      />
      <div
        className="flex flex-col items-center text-center leading-tight"
        style={{ fontSize: mm(4.5), minHeight: mm(11) }}
      >
        {nome && <span className="font-medium">{FRANTOIO.nome}</span>}
        {telefono && <span className="tabular-nums">{FRANTOIO.telefono}</span>}
      </div>
    </div>
  )
}
