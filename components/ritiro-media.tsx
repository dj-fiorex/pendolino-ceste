"use client";

import { CameraIcon, PenLineIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SignaturePad } from "@/components/signature-pad";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { mediaLabel, photoFrom } from "@/lib/media";

/**
 * What the Operatore has taken on this Ritiro besides the Ceste: the Cliente's
 * signature and the photograph of his load, each as it stands on the device
 * before the Ritiro is confirmed and either of them goes anywhere.
 */
export type CapturedMedia = { signature: Blob | null; photo: Blob | null };

/** What every Ritiro starts with, and what most of them are confirmed with. */
export const NOTHING_CAPTURED: CapturedMedia = { signature: null, photo: null };

/** A file on the device as an `<img>` can show it, and tidied up after. */
function usePreview(file: Blob | null) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (file === null) {
      setPreview(null);
      return;
    }
    const shown = URL.createObjectURL(file);
    setPreview(shown);
    return () => URL.revokeObjectURL(shown);
  }, [file]);
  return preview;
}

/** One of the two, once it has been taken: what it is, and the two ways out. */
function Taken({
  label,
  preview,
  onRetake,
  onRemove,
}: {
  label: string;
  preview: string;
  onRetake: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex h-14 items-center gap-2 rounded-lg border bg-card px-2">
      <button
        type="button"
        onClick={onRetake}
        aria-label={`Rifai: ${label}`}
        className="shrink-0"
      >
        {/* The Operatore's own file, a moment old and never on a server: a
            plain img rather than anything that would want to optimise it. */}
        <img
          src={preview}
          alt={label}
          className="h-10 w-14 rounded border object-contain"
        />
      </button>
      <span className="flex-1 truncate text-sm font-medium">{label}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Togli: ${label}`}
        onClick={onRemove}
      >
        <XIcon className="size-4" />
      </Button>
    </div>
  );
}

/**
 * The signature and the photograph of a Ritiro, offered and never asked for
 * (spec #1, stories 17 to 19).
 *
 * Both are one tap away and neither is on the way to anything: confirming a
 * Ritiro without them is the same single tap on the same button it always was,
 * because on a morning of a hundred and fifty people they are usually skipped
 * and that is the mill's own decision (#25). Nothing here is ever a step to
 * dismiss.
 *
 * The photograph is taken by the phone's own camera app, through a file input,
 * rather than by a second camera opened in the page. The counter's scanner is
 * already holding the camera and reading QR off it (#23), and two streams
 * asking one lens for a picture is a fight one of them loses; handing the job
 * to the phone means there is only ever one stream in the page. It also gets
 * the mill a photograph worth keeping — the camera app's full frame, focus and
 * flash, downscaled here to 1600 px afterwards, where a scanner preview would
 * have given a few hundred pixels of trailer.
 */
export function RitiroMedia({
  captured,
  onCapture,
}: {
  captured: CapturedMedia;
  onCapture: (captured: CapturedMedia) => void;
}) {
  const [signing, setSigning] = useState(false);
  // The signature as it stands on the open pad. It becomes the Ritiro's only
  // when the Operatore says so, so that a pad opened by mistake and closed
  // again changes nothing.
  const [drawn, setDrawn] = useState<Blob | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const signature = usePreview(captured.signature);
  const photo = usePreview(captured.photo);

  /**
   * A blank pad, every time it is opened.
   *
   * Emptied here, where the pad is opened, and not on the dialog's own change
   * of state: the dialog is opened from this side, so it never reports being
   * opened, and a reset written there would never run. What that left behind
   * was a pad that looked blank and was not — a signature taken off with the X
   * and then confirmed again by somebody who had drawn nothing.
   */
  const openThePad = () => {
    setDrawn(null);
    setSigning(true);
  };

  const takePhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const [taken] = event.target.files ?? [];
    // Emptied straight away, so that photographing the same load twice is
    // twice: an input handed back the same file reports no change.
    event.target.value = "";
    if (taken === undefined) {
      return;
    }
    setTrouble(null);
    try {
      onCapture({ ...captured, photo: await photoFrom(taken) });
    } catch {
      setTrouble("Non sono riuscito a preparare la foto. Riprova.");
    }
  };

  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-2 gap-3">
        {signature === null ? (
          <Button
            type="button"
            variant="outline"
            className="h-14 text-base"
            onClick={openThePad}
          >
            <PenLineIcon className="size-5" />
            {mediaLabel.signature}
          </Button>
        ) : (
          <Taken
            label={mediaLabel.signature}
            preview={signature}
            onRetake={openThePad}
            onRemove={() => onCapture({ ...captured, signature: null })}
          />
        )}

        {photo === null ? (
          <Button
            type="button"
            variant="outline"
            className="h-14 text-base"
            onClick={() => camera.current?.click()}
          >
            <CameraIcon className="size-5" />
            {mediaLabel.photo}
          </Button>
        ) : (
          <Taken
            label={mediaLabel.photo}
            preview={photo}
            onRetake={() => camera.current?.click()}
            onRemove={() => onCapture({ ...captured, photo: null })}
          />
        )}
      </div>

      <input
        ref={camera}
        type="file"
        accept="image/*"
        // The camera on the back of the phone, opened by the phone itself.
        capture="environment"
        className="hidden"
        onChange={(event) => void takePhoto(event)}
      />

      {trouble === null ? (
        <p className="text-xs text-muted-foreground">
          Firma e foto sono facoltative: il Ritiro si conferma anche senza.
        </p>
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {trouble}
        </p>
      )}

      <Dialog open={signing} onOpenChange={setSigning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Firma del Cliente</DialogTitle>
            <DialogDescription>
              Passa il telefono al Cliente e fai firmare con il dito. Si può
              chiudere senza firmare.
            </DialogDescription>
          </DialogHeader>
          <SignaturePad onDrawn={setDrawn} />
          <Button
            type="button"
            className="h-12 text-base"
            disabled={drawn === null}
            onClick={() => {
              onCapture({ ...captured, signature: drawn });
              setSigning(false);
            }}
          >
            Va bene così
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
