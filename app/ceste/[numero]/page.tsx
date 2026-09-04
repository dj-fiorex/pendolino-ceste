import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CampagnaBar } from "@/components/campagna-bar";
import { RettificaForm } from "@/components/rettifica-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery, signedInOperatore } from "@/lib/auth-server";
import { formaLabel, stateClass, stateLabel } from "@/lib/ceste";
import { clienteLabel } from "@/lib/cliente";
import {
  movimentoInSentence,
  movimentoLabel,
  rettificaLine,
} from "@/lib/movimento";
import { cn } from "@/lib/utils";

/** The mill is in Italy, and so is every hour it writes down. */
const whenLabel = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Rome",
});

/**
 * One Cesta: what is printed on her Etichetta, where she is, and everything
 * that ever happened to her, newest first.
 *
 * It is also where an Admin records a Rettifica — the only way a Cesta leaves
 * the mill's Ceste and the only way she comes back to them (spec #1, story 37).
 * A Dismessa Cesta keeps this page and keeps her history: nothing that happened
 * is ever deleted (ADR-0004).
 */
export default async function CestaPage({
  params,
}: {
  params: Promise<{ numero: string }>;
}) {
  const { signedIn, operatore } = await signedInOperatore();
  if (!signedIn) {
    redirect("/accedi");
  }
  if (operatore === null) {
    redirect("/");
  }

  // Whatever the address bar carries: a numero no Cesta answers to reads as a
  // page that is not there.
  const cesta = await fetchAuthQuery(api.ceste.get, {
    numero: (await params).numero,
  });
  if (cesta === null) {
    notFound();
  }
  const movimenti = await fetchAuthQuery(api.movimenti.byCesta, {
    cestaId: cesta._id,
  });

  // What each correction of a misregistration puts right, said the way the
  // history below names it: the two Movimenti are on the same page and the
  // wrong one is still there to read (ADR-0004, #28).
  const corrects = new Map(
    movimenti.flatMap((movimento) => {
      const put = movimenti.find(
        (other) => other._id === movimento.rettifica?.corrects,
      );
      return put === undefined
        ? []
        : [
            [
              movimento._id,
              `${movimentoInSentence[put.kind]} del ${whenLabel.format(put.at)}`,
            ] as const,
          ];
    }),
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-6">
      <div className="space-y-2">
        <Link
          href="/ceste"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Le Ceste
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight tabular-nums">
          {cesta.codice}
        </h1>
        <p className="text-muted-foreground">
          {cesta.portata} kg · {formaLabel[cesta.forma]}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-3 py-1 text-sm font-semibold",
              stateClass[cesta.state],
            )}
          >
            {stateLabel[cesta.state]}
          </span>
          {cesta.cliente !== null && (
            <span className="text-sm text-muted-foreground">
              {clienteLabel(cesta.cliente)}
            </span>
          )}
        </div>
      </div>

      {operatore.role === "admin" && (
        <div className="grid gap-3">
          <CampagnaBar />
          {/* Her history goes in as well as being shown below it: a correction
              of a misregistration picks the Movimento it puts right out of it
              (#28). */}
          <RettificaForm cesta={cesta} movimenti={movimenti} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>La sua storia</CardTitle>
          <CardDescription>
            {movimenti.length === 0
              ? "Non le è ancora successo niente."
              : "Tutto quello che le è successo, dall'ultima volta."}
          </CardDescription>
        </CardHeader>
        {movimenti.length > 0 && (
          <CardContent>
            <ul className="grid gap-2">
              {movimenti.map((movimento) => (
                <li
                  key={movimento._id}
                  className="flex items-baseline justify-between gap-3 rounded-lg border bg-card px-4 py-3"
                >
                  <div>
                    <p className="font-display text-lg font-bold">
                      {movimentoLabel[movimento.kind]}
                    </p>
                    {/* What a Rettifica corrected, beside what actually
                        happened: the pair the whole project exists to show
                        (ADR-0005). */}
                    {movimento.rettifica !== null && (
                      <p className="text-sm">
                        {rettificaLine(movimento.rettifica)}
                      </p>
                    )}
                    {/* And, on a correction of a misregistration, which of the
                        Movimenti below it puts right — the one that stays
                        exactly as it was written (ADR-0004, #28). */}
                    {corrects.get(movimento._id) !== undefined && (
                      <p className="text-sm text-muted-foreground">
                        Corregge {corrects.get(movimento._id)}
                      </p>
                    )}
                    {movimento.rettifica?.note !== undefined && (
                      <p className="text-sm text-muted-foreground">
                        «{movimento.rettifica.note}»
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {movimento.cliente === null
                        ? movimento.operatore
                        : `${clienteLabel(movimento.cliente)} · ${movimento.operatore}`}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {whenLabel.format(movimento.at)}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>
    </main>
  );
}
