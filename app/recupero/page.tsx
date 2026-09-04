import Link from "next/link";
import { redirect } from "next/navigation";
import { RecuperoList } from "@/components/recupero-list";
import { signedInOperatore } from "@/lib/auth-server";

/**
 * The Lista di recupero: everybody holding Ceste right now, worst first, with
 * the telephone to call.
 *
 * Every Operatore's, not an Admin's: chasing a Cesta on a quiet afternoon is
 * counter work (spec #1). Only the Soglia di ritardo below the list is an
 * Admin's, and the mutation refuses everybody else regardless of what this
 * page offers.
 */
export default async function Recupero() {
  const { signedIn, operatore } = await signedInOperatore();
  if (!signedIn) {
    redirect("/accedi");
  }
  if (operatore === null) {
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
          Chi ha le Ceste
        </h1>
        <p className="text-muted-foreground">
          Chi ne ha Fuori, da quanto, e il numero da chiamare. Chi aspetta da
          più tempo sta in cima. Non manca nessuno: si esce da qui solo con un
          Rientro o una Rettifica.
        </p>
      </div>
      <RecuperoList canSetSoglia={operatore.role === "admin"} />
    </main>
  );
}
