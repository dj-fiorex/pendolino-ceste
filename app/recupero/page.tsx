import { redirect } from "next/navigation";
import { RecuperoList } from "@/components/recupero-list";
import { signedInOperatore } from "@/lib/auth-server";

/**
 * The Lista di recupero: everybody holding Ceste right now, worst first, with
 * the telephone to call.
 *
 * Every Operatore's, not an Admin's: chasing a Cesta on a quiet afternoon is
 * counter work (spec #1). Two things on it are an Admin's — the Soglia di
 * ritardo below the list, and writing an SMS to somebody on it — and the
 * mutations refuse everybody else regardless of what this page offers.
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
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 p-4 md:p-6 lg:max-w-4xl">
      <div className="space-y-2">
        {/* The mill's own name for this list (CONTEXT.md), with what it is
            said underneath for whoever has not heard it called that yet. */}
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Lista di recupero
        </h1>
        <p className="text-muted-foreground">
          Chi ha Ceste Fuori, da quanto, e il numero da chiamare. Chi aspetta da
          più tempo sta in cima. Non manca nessuno: si esce da qui solo con un
          Rientro o una Rettifica.
        </p>
      </div>
      <RecuperoList isAdmin={operatore.role === "admin"} />
    </main>
  );
}
