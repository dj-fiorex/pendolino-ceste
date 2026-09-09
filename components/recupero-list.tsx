"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { SmsComposer } from "@/components/sms-composer";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { phoneInNational } from "@/convex/phone";
import {
  cesteCount,
  dayOf,
  daysAgo,
  daysLabel,
  daysSince,
  inRitardo,
} from "@/lib/ceste";
import { clienteLabel } from "@/lib/cliente";
import { cn } from "@/lib/utils";

/** One Cesta on a row: which she is, and since when he has had her. */
function CestaFuori({
  numero,
  since,
}: {
  numero: number;
  since: number | null;
}) {
  return (
    <li className="rounded-md border bg-background px-2 py-1 text-sm">
      <span className="font-display font-bold tabular-nums">{numero}</span>
      <span className="text-muted-foreground">
        {since === null
          ? " · da quando non lo sappiamo"
          : ` · dal ${dayOf(since)}`}
      </span>
    </li>
  );
}

/**
 * The Lista di recupero: chi ha le Ceste, da quanto, e il numero da chiamare.
 *
 * Sorted worst first by the query and never filtered by anything — a Cliente
 * who took Ceste this morning is on it beside one who has had them since
 * October, and a Cliente the mill has written off stays on it until his Ceste
 * come back (ADR-0004, #22). The Soglia di ritardo only decides which rows are
 * coloured.
 *
 * Readable by every Operatore, so that telephoning somebody on a quiet
 * afternoon does not need an Admin (spec #1).
 */
export function RecuperoList({ isAdmin }: { isAdmin: boolean }) {
  const list = useQuery(api.recupero.list, {});

  if (list === undefined) {
    return <p className="text-sm text-muted-foreground">Un attimo…</p>;
  }

  const { sogliaRitardo, clienti } = list;

  return (
    <div className="grid gap-6">
      {clienti.length === 0 ? (
        <p className="text-muted-foreground">
          Nessuno ha Ceste Fuori. Sono tutte qui.
        </p>
      ) : (
        <ol className="grid gap-3">
          {clienti.map((row) => {
            const late = inRitardo(row.since, sogliaRitardo);
            return (
              <li
                key={row.cliente._id}
                className={cn(
                  "rounded-xl border bg-card p-4",
                  // Amber and not red: being late is something to say out loud,
                  // not something that has gone wrong (ADR-0005). It is the
                  // same colour the counter's warnings wear, so that an
                  // Operatore learns one shape and then reads it.
                  late &&
                    "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40",
                )}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    href={`/clienti/${row.cliente._id}`}
                    className="font-display text-lg font-bold underline-offset-4 hover:underline"
                  >
                    {clienteLabel(row.cliente)}
                  </Link>
                  <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                    {cesteCount(row.ceste.length)}
                  </span>
                </div>

                <p className="text-sm text-muted-foreground">
                  {row.since === null
                    ? "Da quando, non lo sappiamo."
                    : daysAgo(row.since) === 0
                      ? "Da oggi."
                      : `Da ${daysSince(row.since)}, dal ${dayOf(row.since)}.`}
                  {late && (
                    <span className="font-semibold text-amber-900 dark:text-amber-100">
                      {" "}
                      In ritardo.
                    </span>
                  )}
                </p>

                {!row.active && (
                  <p className="mt-2 inline-flex rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">
                    Cliente disattivato · le Ceste restano sue
                  </p>
                )}

                <ul className="mt-3 flex flex-wrap gap-2">
                  {row.ceste.map((cesta) => (
                    <CestaFuori
                      key={cesta._id}
                      numero={cesta.numero}
                      since={cesta.since}
                    />
                  ))}
                </ul>

                {row.cliente.phone === null ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Telefono non lo sappiamo.
                  </p>
                ) : (
                  // Chiama e Scrivi uno accanto all'altro: è così che va un
                  // sollecito. Scrivere è di un Admin, chiamare di chiunque.
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Button
                      asChild
                      variant="outline"
                      className="h-11 text-base"
                    >
                      <a href={`tel:${row.cliente.phone}`}>
                        Chiama {phoneInNational(row.cliente.phone)}
                      </a>
                    </Button>
                    {isAdmin && (
                      <SmsComposer
                        cliente={row.cliente}
                        className="h-11 text-base"
                      />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <p className="text-sm text-muted-foreground">
        In ritardo dopo {daysLabel(sogliaRitardo)} Fuori.{" "}
        {isAdmin ? (
          <>
            La Soglia si cambia in{" "}
            <Link
              href="/frantoio"
              className="underline underline-offset-4 hover:text-foreground"
            >
              «Il frantoio»
            </Link>
            .
          </>
        ) : (
          "La Soglia la cambia un Admin."
        )}
      </p>
    </div>
  );
}
