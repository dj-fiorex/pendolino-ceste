import type { CSSProperties } from "react";
import {
  ETICHETTA_LAYOUTS,
  etichettaText,
  footerLines,
  type EtichettaSettings,
} from "@/lib/etichetta";
import { qrBlocks } from "@/lib/qr";

/**
 * One Etichetta as it will come off the print shop's press: the
 * `<portata>-<forma>` prefix small above, the numero large, the QR of the bare
 * Codice, and the mill's name and telephone when the Admin has switched them
 * on.
 *
 * Laid out in millimetres through `--mm`, so that the same measurements serve
 * the preview on screen and the PDF (`lib/etichette-pdf.ts`).
 */
export function Etichetta({
  codice,
  settings,
  pxPerMm,
}: {
  codice: string;
  settings: EtichettaSettings;
  pxPerMm: number;
}) {
  const layout = ETICHETTA_LAYOUTS[settings.etichettaSize];
  const mm = (value: number) => `calc(var(--mm) * ${value})`;
  const { prefix, numero } = etichettaText(codice);
  const { size, blocks } = qrBlocks(codice);

  return (
    <div
      style={
        {
          "--mm": `${pxPerMm}px`,
          width: mm(layout.width),
          height: mm(layout.height),
          padding: mm(layout.padding),
        } as CSSProperties
      }
      className="flex shrink-0 flex-col items-center justify-between bg-white font-sans text-black"
    >
      <div className="flex flex-col items-center">
        <span
          className="leading-none font-medium tracking-wide tabular-nums"
          style={{ fontSize: mm(layout.prefixFont) }}
        >
          {prefix}
        </span>
        <span
          className="leading-none font-bold tabular-nums"
          style={{
            fontSize: mm(layout.numeroFont),
            marginTop: mm(layout.prefixFont * 0.2),
          }}
        >
          {numero}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${size} ${size}`}
        shapeRendering="crispEdges"
        role="img"
        aria-label={`Codice ${codice}`}
        style={{ width: mm(layout.qr), height: mm(layout.qr) }}
      >
        {blocks.map((block) => (
          <rect
            key={`${block.row}-${block.col}`}
            x={block.col}
            y={block.row}
            width={block.width}
            height={block.height}
          />
        ))}
      </svg>

      <div
        className="flex flex-col items-center text-center leading-tight"
        style={{ fontSize: mm(layout.footerFont) }}
      >
        {footerLines(settings).map((line) => (
          <span key={line} className="tabular-nums">
            {line}
          </span>
        ))}
      </div>
    </div>
  );
}
