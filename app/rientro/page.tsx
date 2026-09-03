import Link from "next/link";
import { redirect } from "next/navigation";
import { RientroFlow } from "@/components/rientro-flow";
import { signedInOperatore } from "@/lib/auth-server";

/**
 * The Rientro: the Cliente drives back in with a load of full Ceste, and one
 * numero off the trailer is enough to say whose they are.
 */
export default async function Rientro() {
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
          Rientro
        </h1>
        <p className="text-muted-foreground">
          Chi riporta le Ceste piene, e quali sono.
        </p>
      </div>
      <RientroFlow />
    </main>
  );
}
