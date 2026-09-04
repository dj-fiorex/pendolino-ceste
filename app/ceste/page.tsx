import Link from "next/link";
import { redirect } from "next/navigation";
import { CesteList } from "@/components/ceste-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery, signedInOperatore } from "@/lib/auth-server";
import { cesteCount } from "@/lib/ceste";

/**
 * The fleet: what the mill owns, of which Portata and Forma, and where each
 * Cesta is. An Admin ticks rows here to print or reprint their Etichette (#29).
 */
export default async function Ceste() {
  const { signedIn, operatore } = await signedInOperatore();
  if (!signedIn) {
    redirect("/accedi");
  }
  if (operatore === null) {
    redirect("/");
  }

  const [ceste, disponibili] = await Promise.all([
    fetchAuthQuery(api.ceste.list, {}),
    fetchAuthQuery(api.ceste.disponibiliByPortata, {}),
  ]);

  // Every Cesta a Cliente is holding: what the Disponibili have fallen by.
  const fuori = ceste.filter((cesta) => cesta.state === "fuori").length;
  // And the ones an Admin has written off, which count nowhere else: they stay
  // on this screen because they are part of what became of the fleet
  // (ADR-0004), and saying how many says why the counts do not add up.
  const dismesse = ceste.filter((cesta) => cesta.state === "dismessa").length;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 p-4 md:p-6 lg:max-w-4xl">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Le Ceste
        </h1>
        <p className="text-muted-foreground">
          {cesteCount(ceste.length)} in tutto.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Disponibili adesso</CardTitle>
          <CardDescription>Al frantoio, vuote, pronte da dare.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex gap-3">
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
          </div>
          <p className="text-sm text-muted-foreground">
            {fuori === 0
              ? "Nessuna Cesta è Fuori."
              : `${cesteCount(fuori)} ${fuori === 1 ? "è Fuori" : "sono Fuori"}, con i Clienti.`}
          </p>
          {dismesse > 0 && (
            <p className="text-sm text-muted-foreground">
              {`${cesteCount(dismesse)} ${dismesse === 1 ? "è Dismessa: non conta" : "sono Dismesse: non contano"} più.`}
            </p>
          )}
        </CardContent>
      </Card>

      {operatore.role === "admin" && (
        <div className="grid gap-3">
          <Button asChild className="h-12 text-base">
            <Link href="/ceste/censimento">Nuovo Censimento</Link>
          </Button>
          {ceste.length > 0 && (
            <Button variant="outline" asChild className="h-12 text-base">
              <Link href="/ceste/etichette">Etichette</Link>
            </Button>
          )}
        </div>
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
        <CesteList ceste={ceste} canPrint={operatore.role === "admin"} />
      )}
    </main>
  );
}
