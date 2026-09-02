import QRCode from "qrcode";

/** A rectangle of dark modules in a QR code, in module coordinates. */
export type QrBlock = {
  row: number;
  col: number;
  width: number;
  height: number;
};

/**
 * The QR code of a Codice, as the rectangles of dark modules to be painted. It
 * carries the bare Codice — `400-R-017` and nothing else, no URL, so that no
 * printed label is ever tied to a domain (ADR-0007) — at error-correction
 * level H, which is what lets a scratched or oil-stained label still scan.
 *
 * Rectangles rather than single modules because a 195-page PDF is a great many
 * of them, and because a corner square drawn as one shape has no seams inside
 * it for a renderer to turn into white lines.
 */
export function qrBlocks(codice: string): { size: number; blocks: QrBlock[] } {
  const { modules } = QRCode.create(codice, { errorCorrectionLevel: "H" });
  const { size, data } = modules;
  const blocks: QrBlock[] = [];
  // The blocks the row above left open, by where they start and how wide they
  // are: an identical run directly below one of them makes it a row taller.
  let above = new Map<string, QrBlock>();

  for (let row = 0; row < size; row++) {
    const open = new Map<string, QrBlock>();
    let col = 0;
    while (col < size) {
      if (data[row * size + col] === 0) {
        col++;
        continue;
      }
      let width = 0;
      while (col + width < size && data[row * size + col + width] !== 0) {
        width++;
      }
      const key = `${col}-${width}`;
      const continued = above.get(key);
      if (continued === undefined) {
        const block = { row, col, width, height: 1 };
        blocks.push(block);
        open.set(key, block);
      } else {
        continued.height++;
        open.set(key, continued);
      }
      col += width;
    }
    above = open;
  }
  return { size, blocks };
}
