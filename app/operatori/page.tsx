import Link from "next/link";
import { redirect } from "next/navigation";
import { OperatoriAdmin } from "@/components/operatori-admin";
import { signedInOperatore } from "@/lib/auth-server";

/**
 * The mill's staff: who is at the counter, who has been invited, and who has
 * left. An Admin's, like everything that acts on the staff rather than on the
 * day's movements (CONTEXT.md) — and refused to everybody else by the
 * mutations themselves, not by this redirect.
 */
export default async function Operatori() {
  const { signedIn, operatore } = await signedInOperatore();
  if (!signedIn) {
    redirect("/accedi");
  }
  if (operatore === null || operatore.role !== "admin") {
    redirect("/");
  }

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
          Gli Operatori
        </h1>
        <p className="text-muted-foreground">
          Chi può entrare e registrare i Movimenti. Chi va via si disattiva:
          quello che ha registrato resta, con il suo nome.
        </p>
      </div>
      {/* Which of these people is the Admin reading the screen: their own row
          offers no way to shut themselves out, and the mutation refuses it
          regardless. */}
      <OperatoriAdmin yourEmail={operatore.email} />
    </main>
  );
}
