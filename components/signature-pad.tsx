"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { asFile, SIGNATURE_HEIGHT, SIGNATURE_WIDTH } from "@/lib/media";

/** How thick a finger writes, at the size the pad is kept. */
const STROKE = 4;

/** Ink and paper. Written down here so that the PNG never comes out blank. */
const INK = "#111111";
const PAPER = "#ffffff";

/**
 * The pad the Cliente signs on with a finger, on the Operatore's own phone
 * handed across the counter (spec #1, story 17).
 *
 * It hands the signature up every time the finger lifts rather than only at
 * the end, so that a name written in three strokes is one signature and the
 * screen above never has to ask the pad for it.
 *
 * Drawn on paper rather than on nothing: a PNG with a transparent background
 * is a signature that disappears against a dark screen months later, and white
 * behind a black stroke costs a PNG almost nothing.
 */
export function SignaturePad({
  onDrawn,
}: {
  /** The pad as it stands, and nothing when it has been wiped. */
  onDrawn: (png: Blob | null) => void;
}) {
  const pad = useRef<HTMLCanvasElement>(null);
  // Whether anything has been written since the pad was last wiped: what the
  // wipe button has to act on, and nothing else reads it.
  const [written, setWritten] = useState(false);
  const drawing = useRef(false);

  /**
   * The pad and the ink to draw on it with, and nothing at all before the
   * canvas is on screen. Every hand below asks for the pair this way, so that
   * "there is nothing to draw on yet" is written once.
   */
  const paperOf = useCallback(() => {
    const canvas = pad.current;
    const paper = canvas?.getContext("2d") ?? null;
    return canvas === null || paper === null ? null : { canvas, paper };
  }, []);

  /** The pad back to blank paper, ready to be written on. */
  const wipe = useCallback(() => {
    const on = paperOf();
    if (on === null) {
      return;
    }
    const { canvas, paper } = on;
    paper.fillStyle = PAPER;
    paper.fillRect(0, 0, canvas.width, canvas.height);
    paper.strokeStyle = INK;
    paper.lineWidth = STROKE;
    paper.lineCap = "round";
    paper.lineJoin = "round";
  }, [paperOf]);

  useEffect(() => {
    wipe();
  }, [wipe]);

  /**
   * Where on the pad a finger is. The pad is kept at a fixed size whatever
   * width the phone gives it, so where the finger touched the screen has to be
   * turned into where it touched the pad.
   */
  const at = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const box = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * canvas.width,
      y: ((event.clientY - box.top) / box.height) * canvas.height,
    };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const paper = paperOf()?.paper;
    if (paper === undefined) {
      return;
    }
    // The finger keeps the pad even when it strays over the edge of it, so
    // that a signature running off the end is a signature and not two.
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const { x, y } = at(event);
    paper.beginPath();
    paper.moveTo(x, y);
    // A tap leaves a dot: the dot on an i is as much of a signature as a
    // stroke is.
    paper.lineTo(x, y);
    paper.stroke();
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const paper = paperOf()?.paper;
    if (!drawing.current || paper === undefined) {
      return;
    }
    const { x, y } = at(event);
    paper.lineTo(x, y);
    paper.stroke();
  };

  const lift = async () => {
    const canvas = paperOf()?.canvas;
    if (!drawing.current || canvas === undefined) {
      return;
    }
    drawing.current = false;
    setWritten(true);
    onDrawn(await asFile(canvas, "image/png"));
  };

  return (
    <div className="grid gap-3">
      <canvas
        ref={pad}
        width={SIGNATURE_WIDTH}
        height={SIGNATURE_HEIGHT}
        aria-label="Spazio per la firma"
        // A finger on the pad writes rather than scrolling the screen under it.
        className="w-full touch-none rounded-lg border bg-white"
        onPointerDown={start}
        onPointerMove={draw}
        onPointerUp={() => void lift()}
        onPointerCancel={() => void lift()}
      />
      <Button
        type="button"
        variant="outline"
        className="h-11 text-base"
        disabled={!written}
        onClick={() => {
          wipe();
          setWritten(false);
          onDrawn(null);
        }}
      >
        Cancella e rifai
      </Button>
    </div>
  );
}
