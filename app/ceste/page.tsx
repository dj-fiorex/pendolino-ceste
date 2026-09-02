import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Forma, State } from "@/convex/schema";
import { fetchAuthQuery, signedInOperatore } from "@/lib/auth-server";
import { cn } from "@/lib/utils";

const formaLabel: Record<Forma, string> = {
  quadrata: "Quadrata",
  rettangolare: "Rettangolare",
};

const stateLabel: Record<State, string> = {
  disponibile: "Disponibile",
  fuori: "Fuori",
  attesa_molitura: "Attesa molitura",
  dismessa: "Dismessa",
};

const stateClass: Record<State, string> = {
  disponibile: "bg-secondary text-secondary-foreground",
  fuori: "bg-primary text-primary-foreground",
  attesa_molitura: "bg-muted text-muted-foreground",
  dismessa: "bg-destructive/10 text-destructive",
};

/** A numero out of the query string, or null when there is no usable one. */
const parseNumero = (value: string | string[] | undefined) => {
  const numero = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
};

/**
 * The fleet: what the mill owns, of which Portata and Forma, and where each
 * Cesta is. `?from=&to=` marks a run of numeri — how a Censimento hands over the
 * Ceste whose Etichette are still to be printed, until the PDF arrives (#29).
 */
export default async function Ceste({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { signedIn, operatore } = await signedInOperatore();
  if (!signedIn) {
    redirect("/accedi");
  }
  if (operatore === null) {
    redirect("/");
  }

  const [ceste, disponibili, { from, to }] = await Promise.all([
    fetchAuthQuery(api.ceste.list, {}),
    fetchAuthQuery(api.ceste.disponibiliByPortata, {}),
    searchParams,
  ]);

  const fromNumero = parseNumero(from);
  const toNumero = parseNumero(to);
  const selected =
    fromNumero !== null && toNumero !== null && fromNumero <= toNumero
      ? ceste.filter(
          (cesta) => cesta.numero >= fromNumero && cesta.numero <= toNumero,
        )
      : [];
  const selectedNumeri = new Set(selected.map((cesta) => cesta.numero));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-6">
      <div className="space-y-2">
        <Link
          href="/"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Indietro
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Le Ceste
        </h1>
        <p className="text-muted-foreground">
          {ceste.length === 1 ? "1 Cesta" : `${ceste.length} Ceste`} in tutto.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Disponibili adesso</CardTitle>
          <CardDescription>Al frantoio, vuote, pronte da dare.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          {disponibili.map(({ portata, count }) => (
            <div
              key={portata}
              className="flex-1 rounded-lg bg-secondary px-4 py-3"
            >
              <p className="font-display text-3xl font-bold text-secondary-foreground tabular-nums">
                {count}
              </p>
              <p className="text-sm text-muted-foreground">da {portata} kg</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {operatore.role === "admin" && (
        <Button asChild className="h-12 text-base">
          <Link href="/ceste/censimento">Nuovo Censimento</Link>
        </Button>
      )}

      {selected.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Etichette da stampare</CardTitle>
            <CardDescription>
              Le {selected.length} Ceste dell&apos;ultimo Censimento, da{" "}
              {selected[0].codice} a {selected[selected.length - 1].codice}: qui
              sotto sono segnate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild className="h-12 w-full text-base">
              <Link href="/ceste">Mostra tutte le Ceste</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {ceste.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Non c&apos;è ancora nessuna Cesta</CardTitle>
            <CardDescription>
              Un Admin fa il Censimento delle Ceste del frantoio, e l&apos;app
              dà a ciascuna il suo numero e il suo Codice.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="grid gap-2">
          {ceste.map((cesta) => (
            <li
              key={cesta.numero}
              aria-current={selectedNumeri.has(cesta.numero) || undefined}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3",
                selectedNumeri.has(cesta.numero) &&
                  "border-primary bg-secondary",
              )}
            >
              <div>
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
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
