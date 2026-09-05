import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClienteDetail } from "@/components/cliente-detail";
import { SmsHistory } from "@/components/sms-history";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { phoneInNational } from "@/convex/phone";
import { fetchAuthQuery, signedInOperatore } from "@/lib/auth-server";
import { cesteCount } from "@/lib/ceste";
import { clienteLabel } from "@/lib/cliente";
import { movimentoLabel } from "@/lib/movimento";

/** The mill is in Italy, and so is every hour it writes down. */
const whenLabel = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Rome",
});

/**
 * One Cliente: the Ceste they are holding, what they have taken, and the
 * corrections any Operatore can make to the registry.
 */
export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { signedIn, operatore } = await signedInOperatore();
  if (!signedIn) {
    redirect("/accedi");
  }
  if (operatore === null) {
    redirect("/");
  }

  // Whatever the address bar carries. A string that is no Cliente's id is
  // refused by the query's own validator, and reads here as a page that is
  // not there.
  const clienteId = (await params).id as Id<"clienti">;
  const [cliente, movimenti] = await Promise.all([
    fetchAuthQuery(api.clienti.get, { clienteId }),
    fetchAuthQuery(api.movimenti.byCliente, { clienteId }),
  ]).catch(() => [null, []] as const);
  if (cliente === null) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 p-4 md:p-6 lg:max-w-4xl">
      <div className="space-y-2">
        <Link
          href="/clienti"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← I Clienti
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {clienteLabel(cliente)}
        </h1>
        <p className="text-muted-foreground">
          {cliente.phone === null
            ? "Telefono non lo sappiamo"
            : phoneInNational(cliente.phone)}
          {cliente.smsOptOut && " · niente SMS"}
        </p>
        {!cliente.active && (
          <p className="inline-flex rounded-full bg-muted px-3 py-1 text-sm font-semibold text-muted-foreground">
            Disattivato
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {cliente.cesteFuori.length === 0
              ? "Nessuna Cesta Fuori"
              : `${cesteCount(cliente.cesteFuori.length)} Fuori`}
          </CardTitle>
          <CardDescription>
            Le Ceste che ha adesso, e che deve ancora riportare.
          </CardDescription>
        </CardHeader>
        {cliente.cesteFuori.length > 0 && (
          <CardContent>
            <ul className="grid grid-cols-3 gap-2">
              {cliente.cesteFuori.map((cesta) => (
                <li
                  key={cesta._id}
                  className="flex h-24 flex-col items-center justify-center rounded-lg border bg-secondary text-secondary-foreground"
                >
                  <span className="font-display text-lg font-bold tabular-nums">
                    {cesta.codice}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {cesta.portata} kg
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      <ClienteDetail
        cliente={cliente}
        codiciFuori={cliente.cesteFuori.map((cesta) => cesta.codice)}
        isAdmin={operatore.role === "admin"}
      />

      <SmsHistory clienteId={cliente._id} />

      {movimenti.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>I Movimenti</CardTitle>
            <CardDescription>
              Ogni Cesta che è passata per le sue mani, dall&apos;ultima.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2">
              {movimenti.map((movimento) => (
                <li
                  key={`${movimento.codice}-${movimento.at}`}
                  className="flex items-baseline justify-between gap-3 rounded-lg border bg-card px-4 py-3"
                >
                  <div>
                    <p className="font-display text-lg font-bold tabular-nums">
                      {movimento.codice}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {movimentoLabel[movimento.kind]} · {movimento.operatore}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {whenLabel.format(movimento.at)}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
