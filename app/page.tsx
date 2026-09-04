import Link from "next/link";
import { redirect } from "next/navigation";
import { CampagnaBar } from "@/components/campagna-bar";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signedInOperatore } from "@/lib/auth-server";
import { roleLabel } from "@/lib/operatore";

export default async function Home() {
  const { signedIn, operatore } = await signedInOperatore();
  if (!signedIn) {
    redirect("/accedi");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 p-6">
      {operatore === null ? (
        <Card>
          <CardHeader>
            <CardTitle>Questo account non è abilitato</CardTitle>
            <CardDescription>
              Chiedi a un Admin del frantoio di riattivarti, poi rientra.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignOutButton />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-muted-foreground">Sei entrato come</p>
            <h1 className="font-display text-3xl font-bold tracking-tight">
              {operatore.name}
            </h1>
            <p className="inline-flex rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-secondary-foreground">
              {roleLabel[operatore.role]}
            </p>
          </div>
          <CampagnaBar />
          <Card>
            <CardHeader>
              <CardTitle>Il banco</CardTitle>
              <CardDescription>
                Chi ritira, chi riporta, e quali Ceste si svuotano.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button asChild className="h-12 text-base">
                <Link href="/ritiro">Nuovo Ritiro</Link>
              </Button>
              <Button asChild className="h-12 text-base">
                <Link href="/rientro">Nuovo Rientro</Link>
              </Button>
              <Button asChild className="h-12 text-base">
                <Link href="/svuotamento">Svuotamento</Link>
              </Button>
              <Button variant="outline" asChild className="h-12 text-base">
                <Link href="/attesa-molitura">Attesa molitura</Link>
              </Button>
              {/* Every Operatore's, not an Admin's: chasing a Cesta on a quiet
                  afternoon is counter work (spec #1, #22). */}
              <Button variant="outline" asChild className="h-12 text-base">
                <Link href="/recupero">Chi ha le Ceste</Link>
              </Button>
              <Button variant="outline" asChild className="h-12 text-base">
                <Link href="/clienti">I Clienti</Link>
              </Button>
            </CardContent>
          </Card>
          {operatore.role === "admin" && (
            <Card>
              <CardHeader>
                <CardTitle>Il Registro, le Campagne e chi lavora qui</CardTitle>
                <CardDescription>
                  Chi ha fatto cosa, e quando. La stagione a cui appartiene. E
                  chi può entrare.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Button variant="outline" asChild className="h-12 text-base">
                  <Link href="/registro">Apri il Registro</Link>
                </Button>
                <Button variant="outline" asChild className="h-12 text-base">
                  <Link href="/campagne">Le Campagne</Link>
                </Button>
                <Button variant="outline" asChild className="h-12 text-base">
                  <Link href="/operatori">Gli Operatori</Link>
                </Button>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Le Ceste</CardTitle>
              <CardDescription>
                Quante Ceste ci sono, di che Portata, e dove sono.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button variant="outline" asChild className="h-12 text-base">
                <Link href="/ceste">Vedi le Ceste</Link>
              </Button>
              <SignOutButton />
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
