import { jsPDF } from "jspdf";
import {
  ETICHETTA_LAYOUTS,
  etichettaText,
  footerLines,
  type EtichettaLayout,
  type EtichettaSettings,
} from "@/lib/etichetta";
import { qrBlocks } from "@/lib/qr";

/** jsPDF measures type in points however the page is measured. */
const pt = (mm: number) => (mm * 72) / 25.4;

/** One Etichetta on the page jsPDF is standing on. */
function drawEtichetta(
  doc: jsPDF,
  codice: string,
  layout: EtichettaLayout,
  settings: EtichettaSettings,
) {
  const { prefix, numero } = etichettaText(codice);
  const centre = layout.width / 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(pt(layout.prefixFont));
  doc.text(prefix, centre, layout.padding, {
    align: "center",
    baseline: "top",
  });

  const numeroTop = layout.padding + layout.prefixFont * 1.1;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(pt(layout.numeroFont));
  doc.text(numero, centre, numeroTop, { align: "center", baseline: "top" });

  const footer = footerLines(settings);
  const footerTop =
    layout.height - layout.padding - footer.length * layout.footerLine;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(pt(layout.footerFont));
  footer.forEach((line, index) => {
    doc.text(line, centre, footerTop + index * layout.footerLine, {
      align: "center",
      baseline: "top",
    });
  });

  // The QR sits in whatever is left between the numero and the foot, so that
  // switching the mill's name off moves it down rather than leaving a hole.
  const from = numeroTop + layout.numeroFont;
  const qrTop = from + (footerTop - from - layout.qr) / 2;
  const qrLeft = centre - layout.qr / 2;
  const { size, blocks } = qrBlocks(codice);
  const module = layout.qr / size;
  doc.setFillColor(0, 0, 0);
  for (const block of blocks) {
    doc.rect(
      qrLeft + block.col * module,
      qrTop + block.row * module,
      block.width * module,
      block.height * module,
      "F",
    );
  }
}

/**
 * The Etichette of a selection of Ceste, one per page, at the size the Admin
 * chose. Built here in the browser and handed straight to the person at the
 * screen: nothing is stored, and a torn label is reprinted by asking for the
 * same Cesta again (#29).
 */
export function etichettePdf(
  codici: string[],
  settings: EtichettaSettings,
): jsPDF {
  const layout = ETICHETTA_LAYOUTS[settings.etichettaSize];
  const format: [number, number] = [layout.width, layout.height];
  const doc = new jsPDF({ unit: "mm", format, compress: true });
  codici.forEach((codice, index) => {
    if (index > 0) {
      doc.addPage(format, "portrait");
    }
    drawEtichetta(doc, codice, layout, settings);
  });
  return doc;
}

/** What the file is called once it is on the Admin's device. */
export const etichettePdfName = (codici: string[]) =>
  codici.length === 1
    ? `etichetta-${codici[0]}.pdf`
    : `etichette-${codici[0]}-${codici[codici.length - 1]}.pdf`;
