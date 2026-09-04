"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
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

/**
 * The Soglia di ritardo, as an Admin changes it. One number for the whole
 * mill, and all it decides is which rows above it are coloured: the list is
 * the same list at one day and at a hundred, which is what makes the setting
 * safe to get wrong (#22).
 */
function SogliaForm({ sogliaRitardo }: { sogliaRitardo: number }) {
  const setSogliaRitardo = useMutation(api.recupero.setSogliaRitardo);
  // The box is the Admin's own edit, kept as they typed it; what the mill is
  // actually running on is read live beside it, so that a Soglia changed on
  // another device never hides behind a half-typed number here.
  const [typed, setTyped] = useState(String(sogliaRitardo));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = Number(typed);
  const isDays = Number.isInteger(days) && days >= 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Soglia di ritardo</CardTitle>
        <CardDescription>
          Adesso è {daysLabel(sogliaRitardo)}. Dopo quanti giorni Fuori una
          Cesta è In ritardo: colora le righe qui sopra e basta, non toglie
          nessuno dall&rsquo;elenco.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            setPending(true);
            try {
              await setSogliaRitardo({ days });
            } catch {
              setError("Non è stato possibile salvare. Riprova.");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="soglia-ritardo">Giorni</Label>
            <Input
              id="soglia-ritardo"
              name="soglia-ritardo"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              className="h-11"
            />
          </div>
          {!isDays && (
            <p role="alert" className="text-sm text-destructive">
              Un numero intero di giorni, da 1 in su.
            </p>
          )}
          {error !== null && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="h-12 text-base"
            disabled={pending || !isDays || days === sogliaRitardo}
          >
            {pending ? "Un attimo…" : "Salva la Soglia"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

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
export function RecuperoList({ canSetSoglia }: { canSetSoglia: boolean }) {
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
                  <Button
                    asChild
                    variant="outline"
                    className="mt-3 h-11 w-full text-base"
                  >
                    <a href={`tel:${row.cliente.phone}`}>
                      Chiama {row.cliente.phone}
                    </a>
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {canSetSoglia ? (
        <SogliaForm sogliaRitardo={sogliaRitardo} />
      ) : (
        <p className="text-sm text-muted-foreground">
          In ritardo dopo {daysLabel(sogliaRitardo)} Fuori. La Soglia la cambia
          un Admin.
        </p>
      )}
    </div>
  );
}
