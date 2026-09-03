"use client";

import { useConvex } from "convex/react";
import { CornerDownLeftIcon, DeleteIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { FoundCesta } from "@/lib/ceste";
import { cn } from "@/lib/utils";

/** The digits, laid out as a telephone lays them out. */
const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * The most digits a numero can be. The mill's fleet is about 195 Ceste and no
 * numero is ever freed (ADR-0007), so four is past anything it will reach — and
 * it keeps the display from running off the end of the keys.
 */
const MAX_DIGITS = 4;

/**
 * The numero of a Cesta typed on keys large enough to hit without looking, and
 * never on the system keyboard: whoever empties Ceste has hands that have been
 * in the olives, and asked for something they can hit with a knuckle (#18).
 *
 * The same contract as the NumeroField at the counter, in a shape a thumb can
 * use: a numero that answers to no Cesta is reported here and nothing is added
 * (spec #1, story 57), and whatever the screen makes of the Cesta that does
 * answer it says on the same line, by handing back what to write.
 *
 * The two read differently, because they are different news. Not finding a
 * Cesta is a failure and is shown as one; a Cesta that went in as asked is not,
 * however much the screen has to say about her.
 */
export function NumeroKeypad({
  onCesta,
}: {
  onCesta: (cesta: FoundCesta) => string | null;
}) {
  const convex = useConvex();
  const [typed, setTyped] = useState("");
  const [notice, setNotice] = useState<{
    text: string;
    found: boolean;
  } | null>(null);

  const press = (digit: string) => {
    if (typed.length >= MAX_DIGITS) {
      return;
    }
    setTyped(typed + digit);
    setNotice(null);
  };

  const add = async () => {
    if (typed === "") {
      return;
    }
    const cesta = await convex.query(api.ceste.byNumero, { numero: typed });
    setTyped("");
    if (cesta === null) {
      setNotice({
        text: `Nessuna Cesta con il numero ${typed}.`,
        found: false,
      });
      return;
    }
    const said = onCesta(cesta);
    setNotice(said === null ? null : { text: said, found: true });
  };

  return (
    <div className="grid gap-3">
      <p
        aria-live="polite"
        className="flex h-16 items-center rounded-lg border bg-muted/50 px-4 font-display text-3xl font-bold tabular-nums"
      >
        {typed === "" ? (
          <span className="text-muted-foreground">···</span>
        ) : (
          typed
        )}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {DIGITS.map((digit) => (
          <Button
            key={digit}
            type="button"
            variant="outline"
            className="h-16 text-2xl"
            onClick={() => press(digit)}
          >
            {digit}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          aria-label="Cancella"
          className="h-16"
          onClick={() => setTyped(typed.slice(0, -1))}
        >
          <DeleteIcon className="size-6" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-16 text-2xl"
          onClick={() => press("0")}
        >
          0
        </Button>
        <Button
          type="button"
          aria-label="Aggiungi"
          className="h-16"
          disabled={typed === ""}
          onClick={add}
        >
          <CornerDownLeftIcon className="size-6" />
        </Button>
      </div>
      {notice !== null && (
        <p
          role="alert"
          className={cn(
            "text-sm",
            notice.found ? "text-muted-foreground" : "text-destructive",
          )}
        >
          {notice.text}
        </p>
      )}
    </div>
  );
}
