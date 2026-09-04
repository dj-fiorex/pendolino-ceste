"use client";

import { useConvex } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { FoundCesta } from "@/lib/ceste";
import { playConfirmation } from "@/lib/sound";

/**
 * What either reader is, as far as this screen is concerned: a camera frame in,
 * whatever was legible in it out. The browser's own and the fallback answer to
 * the same shape, because the fallback is a ponyfill of the browser's own.
 */
type QrReader = {
  detect(frame: HTMLVideoElement): Promise<{ rawValue: string }[]>;
};

type NativeBarcodeDetector = {
  new (options: { formats: string[] }): QrReader;
  getSupportedFormats(): Promise<readonly string[]>;
};

/**
 * The QR reader this device has. Chrome on Android — the phone at this counter
 * — decodes QR in the browser itself, so nothing is downloaded and nothing is
 * decoded in JavaScript. Safari has no such thing, and only there is the
 * WebAssembly fallback fetched, which is why it is imported here rather than at
 * the top of the file.
 */
async function qrReader(): Promise<QrReader> {
  const Native = (globalThis as { BarcodeDetector?: NativeBarcodeDetector })
    .BarcodeDetector;
  if (
    Native !== undefined &&
    (await Native.getSupportedFormats()).includes("qr_code")
  ) {
    return new Native({ formats: ["qr_code"] });
  }
  const { BarcodeDetector } = await import("barcode-detector/ponyfill");
  return new BarcodeDetector({ formats: ["qr_code"] });
}

/**
 * How often the camera is asked what it can see. Four times a second is faster
 * than an Operatore can move the phone from one Cesta to the next, and it
 * leaves the phone the rest of the second to be a phone: the counter is not the
 * bottleneck (spec #1), and a scanner that empties a battery by eleven is worse
 * than one that reads a Cesta a fifth of a second later.
 */
const LOOK_EVERY = 250;

/**
 * How long a Cesta stays read after leaving the movement. She is taken off it
 * with a tap while the phone is still, most likely, aimed at her label, and a
 * Cesta that jumped straight back on would be a Cesta nobody could remove. A
 * moment later the camera reads her again like any other, because a second
 * thought is allowed to be a second thought.
 */
const FORGET_AFTER = 2_000;

/**
 * The camera at the counter: it stays open, and every Cesta it recognises joins
 * the movement being built, with a beep so that the Operatore can watch the
 * load rather than the screen (#23).
 *
 * Six Ceste are one continuous action here rather than six separate ones. The
 * numero field stays beside it throughout and never behind a switch — that
 * pairing is the CestaReader's to hold, because a camera that could be shown
 * without it would eventually be.
 *
 * The QR carries the Cesta's Codice and nothing else (ADR-0007), so a scan and
 * a typed numero are one question asked twice — `ceste.byCodice` and
 * `ceste.byNumero` answer it with the same Cesta in the same shape, and what
 * the screen makes of her is written once, in the flow, for both.
 */
export function Scanner({
  codici,
  onCesta,
}: {
  /**
   * The Codici already in this movement, however they got there. The camera
   * holds a label in view for a second or more and reads it every frame, so
   * what is already in is what it has nothing left to say about — and a Cesta
   * whose numero was typed is as much in as one that was scanned.
   */
  codici: string[];
  /**
   * The same contract the NumeroField and the NumeroKeypad have: the flow takes
   * the Cesta and hands back what to write about her, or nothing where there is
   * nothing to say.
   */
  onCesta: (cesta: FoundCesta) => string | null;
}) {
  const convex = useConvex();
  const video = useRef<HTMLVideoElement>(null);
  // What the camera has to say, and whether it is bad news. The two read
  // differently because they are different news, as they do on the keypad
  // (#18): a QR that answers to no Cesta is a failure and is shown as one.
  const [notice, setNotice] = useState<{ text: string; found: boolean } | null>(
    null,
  );
  const [trouble, setTrouble] = useState<string | null>(null);
  /**
   * When each Codice was last in the movement, or last handed to it. Read
   * inside a loop that outlives any one render, so it is held here rather than
   * in state.
   *
   * A Codice leaves this map's freshness by leaving the movement, which is what
   * makes the tap that takes a Cesta off the list stick: the moment counted
   * from is the moment she left it, not the moment she was read.
   */
  const lastInTheMovement = useRef(new Map<string, number>());
  // The list and the flow's answer as they stand now. The camera is started
  // once and runs until the screen is left, so it reads them from here instead
  // of being torn down and restarted each time a Cesta joins the movement.
  const latest = useRef({ codici, onCesta });

  useEffect(() => {
    latest.current = { codici, onCesta };
    const now = Date.now();
    for (const codice of codici) {
      lastInTheMovement.current.set(codice, now);
    }
  });

  useEffect(() => {
    const frame = video.current;
    if (frame === null || navigator.mediaDevices === undefined) {
      setTrouble("Fotocamera non disponibile. Scrivi il numero qui sotto.");
      return;
    }

    let stopped = false;
    let stream: MediaStream | null = null;
    let looking: ReturnType<typeof setInterval> | undefined;
    // One frame is read at a time: the reader is slower than the interval on a
    // tired phone, and a queue of frames would only make it slower.
    let reading = false;
    // One opening at a time, for the same reason: coming back to the screen
    // twice in a moment must not ask for two cameras.
    let opening = false;

    /**
     * Whether the camera has anything to say about this Codice. A Cesta already
     * in the movement has nothing left to add, whether she was scanned or
     * typed. One that has just left it — tapped off the list — and one that
     * answered to no Cesta at all are left alone for a moment and then read
     * again like any other.
     */
    const alreadyRead = (codice: string) => {
      if (latest.current.codici.includes(codice)) {
        return true;
      }
      const at = lastInTheMovement.current.get(codice);
      return at !== undefined && Date.now() - at < FORGET_AFTER;
    };

    const hand = async (codice: string) => {
      if (alreadyRead(codice)) {
        return;
      }
      // Noted before the Cesta is looked up rather than after, so that the next
      // frame — the label is still in view — does not ask the same question.
      lastInTheMovement.current.set(codice, Date.now());
      const cesta = await convex.query(api.ceste.byCodice, { codice });
      if (stopped) {
        return;
      }
      if (cesta === null) {
        // A label from somewhere else, or a QR that was never a Codice. There
        // is no Cesta to record, so nothing is added and the screen says so
        // (spec #1, story 57).
        setNotice({
          text: "Questo QR non è di una Cesta del frantoio.",
          found: false,
        });
        return;
      }
      // The beep is the whole point of a scanner: it says a Cesta went in
      // without anybody having to look away from the load (#23). It sounds only
      // for a Cesta that did go in, so that it never confirms nothing.
      playConfirmation();
      const said = latest.current.onCesta(cesta);
      setNotice(said === null ? null : { text: said, found: true });
    };

    const look = async (reader: QrReader) => {
      if (reading || stopped) {
        return;
      }
      reading = true;
      try {
        for (const found of await reader.detect(frame)) {
          const codice = found.rawValue.trim();
          if (codice !== "" && !stopped) {
            await hand(codice);
          }
        }
      } catch {
        // A frame nothing could be read in is most of them.
      } finally {
        reading = false;
      }
    };

    /** The camera goes out, wherever in the opening we had got to. */
    const closeCamera = () => {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    };

    const noCamera = () => {
      // Refused, or there is no camera, or it opened and could not be read
      // from. The numero field below is the whole of what an Operatore needs,
      // so this is said and nothing is blocked (ADR-0005) — and a camera that
      // is not being read from does not stay lit behind the message.
      closeCamera();
      if (!stopped) {
        setTrouble("Fotocamera non disponibile. Scrivi il numero qui sotto.");
      }
    };

    const open = async () => {
      opening = true;
      try {
        try {
          // The camera on the back of the phone: the one pointed at the
          // trailer.
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
          });
        } catch {
          noCamera();
          return;
        }
        if (stopped) {
          // The screen was left while the camera was being asked for, so the
          // clean-up below had nothing to turn off yet. This is where it goes
          // out: a light left on in somebody's pocket is a camera left running.
          closeCamera();
          return;
        }
        frame.srcObject = stream;
        try {
          await frame.play();
          const reader = await qrReader();
          if (stopped) {
            return;
          }
          // A camera asked for again after the phone's own took it away is a
          // camera that works: whatever the screen said about it is no longer
          // true.
          setTrouble(null);
          looking = setInterval(() => void look(reader), LOOK_EVERY);
        } catch {
          noCamera();
        }
      } finally {
        opening = false;
      }
    };

    /** Whether the camera we were given is still a camera we can read. */
    const stillOurs = () =>
      stream !== null &&
      stream.getVideoTracks().some((track) => track.readyState === "live");

    /**
     * The screen came back to the front. The phone's own camera app was over
     * it — the Operatore was photographing the load (#25) — or a call was, and
     * either can have taken the camera away from the page while it was behind
     * them.
     *
     * A camera still ours only needs the picture started again; one that was
     * taken away is asked for afresh. Without this the scanner would come back
     * from a photograph as a frozen frame, and an Operatore would go on aiming
     * the phone at Ceste that nothing was reading.
     */
    const cameBack = () => {
      if (stopped || opening || document.visibilityState !== "visible") {
        return;
      }
      if (stillOurs()) {
        void frame.play().catch(() => {
          // A picture that will not restart is a camera to ask for again.
          clearInterval(looking);
          closeCamera();
          void open();
        });
        return;
      }
      clearInterval(looking);
      closeCamera();
      void open();
    };

    document.addEventListener("visibilitychange", cameBack);
    void open();

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", cameBack);
      clearInterval(looking);
      // The camera light goes out when the Ritiro is confirmed, not when the
      // phone is put away.
      closeCamera();
      frame.srcObject = null;
    };
  }, [convex]);

  return (
    <div className="grid gap-2">
      <div className="relative overflow-hidden rounded-lg border bg-muted">
        <video
          ref={video}
          muted
          playsInline
          autoPlay
          aria-label="Inquadratura della fotocamera"
          className="h-40 w-full object-cover"
        />
        {trouble !== null && (
          <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-muted-foreground">
            {trouble}
          </p>
        )}
      </div>
      {notice === null || notice.found ? (
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {notice?.text ?? "Inquadra il QR di ogni Cesta, una dopo l'altra."}
        </p>
      ) : (
        <p role="alert" className="text-sm text-destructive">
          {notice.text}
        </p>
      )}
    </div>
  );
}
