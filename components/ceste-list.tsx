"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Forma, State } from "@/convex/schema";
import { formaLabel, stateClass, stateLabel } from "@/lib/ceste";
import { cn } from "@/lib/utils";

/** A Cesta as the fleet screen shows her. */
export type FleetCesta = {
  numero: number;
  codice: string;
  portata: number;
  forma: Forma;
  state: State;
};

/**
 * The fleet, by numero: what exists, of which Portata and Forma, and where
 * each Cesta is. An Admin can tick rows here and take exactly those Ceste to
 * the Etichette — which is how a torn label is reprinted (#29).
 */
export function CesteList({
  ceste,
  canPrint,
}: {
  ceste: FleetCesta[];
  canPrint: boolean;
}) {
  const [ticked, setTicked] = useState<number[]>([]);

  const tick = (numero: number, on: boolean) =>
    setTicked((current) =>
      on
        ? [...current, numero].sort((a, b) => a - b)
        : current.filter((other) => other !== numero),
    );

  return (
    <>
      <ul className="grid gap-2">
        {ceste.map((cesta) => {
          const isTicked = ticked.includes(cesta.numero);
          const row = (
            <>
              {canPrint && (
                <input
                  type="checkbox"
                  aria-label={`Etichetta della Cesta ${cesta.codice}`}
                  checked={isTicked}
                  onChange={(event) => tick(cesta.numero, event.target.checked)}
                  className="size-5 shrink-0 accent-primary"
                />
              )}
              <div className="flex-1">
                <p className="font-display text-lg font-bold tabular-nums">
                  {cesta.codice}
                </p>
                <p className="text-sm text-muted-foreground">
                  {cesta.portata} kg · {formaLabel[cesta.forma]}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-semibold",
                  stateClass[cesta.state],
                )}
              >
                {stateLabel[cesta.state]}
              </span>
            </>
          );
          const inner = "flex flex-1 items-center gap-3";

          return (
            <li
              key={cesta.numero}
              className={cn(
                "flex items-center gap-3 rounded-lg border bg-card px-4 py-3",
                isTicked && "border-primary bg-secondary",
              )}
            >
              {canPrint ? (
                <label className={inner}>{row}</label>
              ) : (
                <div className={inner}>{row}</div>
              )}
              {/* Her own page: where she has been, and where an Admin says
                  she has got to (#20). */}
              <Link
                href={`/ceste/${cesta.numero}`}
                aria-label={`Apri la Cesta ${cesta.codice}`}
                className="text-muted-foreground"
              >
                <ChevronRightIcon className="size-5" />
              </Link>
            </li>
          );
        })}
      </ul>

      {ticked.length > 0 && (
        <div className="sticky bottom-4 rounded-xl border bg-card p-3 shadow-lg">
          <Button asChild className="h-12 w-full text-base">
            <Link href={`/ceste/etichette?numeri=${ticked.join(",")}`}>
              {ticked.length === 1
                ? "Stampa 1 Etichetta"
                : `Stampa ${ticked.length} Etichette`}
            </Link>
          </Button>
        </div>
      )}
    </>
  );
}
