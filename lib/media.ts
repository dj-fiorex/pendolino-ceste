import type { Id } from "@/convex/_generated/dataModel";
import type { MediaKind } from "@/convex/schema";

/**
 * What each of the two is called, wherever a screen names one: on the button
 * that offers it, on the thumbnail that keeps it, and in the line that says it
 * did not go up. One record, as `movimentoLabel` and `stateLabel` are, so that
 * an Operatore reads one word for one thing.
 */
export const mediaLabel: Record<MediaKind, string> = {
  signature: "Firma",
  photo: "Foto",
};

/** The same two as a sentence names them: "la firma non è stata caricata". */
export const mediaInSentence: Record<MediaKind, string> = {
  signature: "la firma",
  photo: "la foto",
};

/**
 * The two there are, in the order a screen offers them: what a question about
 * *which* of them — which the Operatore took, which the device did not keep —
 * is asked over.
 *
 * Read off `mediaLabel` rather than written out again, as the Etichetta sizes
 * are read off their own labels, so that a third kind cannot be added to one
 * and forgotten in the other.
 */
export const mediaKinds = Object.keys(mediaLabel) as MediaKind[];

/**
 * The ones a sentence is about, listed as the counter would say them: "la
 * firma", "la firma e la foto".
 *
 * Every line that has something to say about what was taken is about a list of
 * these, so the list is put together in one place and the sentences differ
 * only where they mean different things.
 */
export const mediaListed = (kinds: readonly MediaKind[]) =>
  kinds.map((kind) => mediaInSentence[kind]).join(" e ");

/**
 * The line that says what the Operatore took is not on the device any more and
 * has to be taken again (#24).
 *
 * Said on the offer that brings a half-done Ritiro back, so that resuming is
 * not mistaken for getting the signature back with it, and said again beside
 * the buttons for as long as it stands — a warning that has scrolled away is a
 * warning nobody sees at the moment they confirm.
 */
export const toRetakeLine = (kinds: readonly MediaKind[]) =>
  `Il telefono non conserva ${mediaListed(kinds)}: ${
    kinds.length === 1 ? "se serve, rifalla" : "se servono, rifalle"
  }.`;

/**
 * The longest side a photograph of a load is kept at. Enough to read a number
 * plate or tell one trailer from another months later, which is the whole of
 * what the photograph is for, and small enough to go up over the mill's signal
 * on a busy morning: a phone's own 12-megapixel JPEG is a dozen times this
 * (spec #1, #25).
 */
export const PHOTO_LONGEST_SIDE = 1600;

/**
 * How hard the JPEG is squeezed. High enough that the compression is not what
 * anybody notices in a photograph of a trailer in a yard.
 */
const PHOTO_QUALITY = 0.8;

/**
 * The size the signature is drawn and kept at: a strip a name fits across, at
 * the resolution a finger is worth. A stroke of black on white at this size is
 * a PNG of a few kilobytes, which is what "a small PNG" means (#25).
 */
export const SIGNATURE_WIDTH = 640;
export const SIGNATURE_HEIGHT = 260;

/** What a canvas has been drawn, as a file. */
export const asFile = (
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (drawn) =>
        drawn === null
          ? reject(new Error("This canvas could not be turned into a file."))
          : resolve(drawn),
      type,
      quality,
    );
  });

/**
 * The photograph the phone's camera took, as the app keeps it: a JPEG of at
 * most `PHOTO_LONGEST_SIDE` on its longest side, downscaled here on the device
 * rather than on the way in, so that what crosses the mill's signal is a few
 * hundred kilobytes and not a dozen megabytes (#25).
 *
 * A photograph already smaller than that is left at the size it came at:
 * nothing is gained by drawing four pixels where the camera had one.
 *
 * The orientation is taken from the file rather than ignored, because a phone
 * held upright writes a landscape image and an EXIF tag saying which way up it
 * goes, and a canvas that ignores the tag turns every portrait photograph on
 * its side.
 */
export async function photoFrom(file: Blob): Promise<Blob> {
  const shot = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  try {
    const scale = Math.min(
      1,
      PHOTO_LONGEST_SIDE / Math.max(shot.width, shot.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(shot.width * scale);
    canvas.height = Math.round(shot.height * scale);
    const paper = canvas.getContext("2d");
    if (paper === null) {
      throw new Error(
        "This device cannot draw the photograph to downscale it.",
      );
    }
    paper.drawImage(shot, 0, 0, canvas.width, canvas.height);
    return await asFile(canvas, "image/jpeg", PHOTO_QUALITY);
  } finally {
    shot.close();
  }
}

/**
 * Puts a file where the app said to put it, and hands back where it landed:
 * the id the Ritiro carries (#25).
 *
 * The upload URL comes from `media.uploadUrl` and is good for this one file;
 * the POST goes to Convex's own storage endpoint rather than through any
 * function of this app, which is why several hundred kilobytes crossing it
 * costs the counter nothing.
 *
 * Wait for the request's result without an application timeout. A slow upload
 * can still succeed. The Ritiro module handles a reported failure by recording
 * without that file and naming it in the result.
 */
export async function upload(
  uploadUrl: string,
  file: Blob,
): Promise<Id<"_storage">> {
  const sent = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!sent.ok) {
    throw new Error(`The upload came back ${sent.status}.`);
  }
  const { storageId } = (await sent.json()) as { storageId: Id<"_storage"> };
  return storageId;
}
