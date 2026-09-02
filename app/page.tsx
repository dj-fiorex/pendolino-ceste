import Link from "next/link";
import { redirect } from "next/navigation";
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

const roleLabel = { admin: "Admin", operatore: "Operatore" } as const;

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
          <Card>
            <CardHeader>
              <CardTitle>Le Ceste</CardTitle>
              <CardDescription>
                Quante Ceste ci sono, di che Portata, e dove sono. Ritiri,
                Rientri e Svuotamenti arrivano nelle prossime versioni.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button asChild className="h-12 text-base">
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
