import Link from "next/link";
import { redirect } from "next/navigation";
import { CampagnaBar } from "@/components/campagna-bar";
import { RitiroFlow } from "@/components/ritiro-flow";
import { signedInOperatore } from "@/lib/auth-server";

/**
 * The Ritiro: the Cliente takes Ceste away, and the mill can finally answer
 * who is holding what. Every Operatore records one.
 */
export default async function Ritiro() {
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
          Ritiro
        </h1>
        <p className="text-muted-foreground">
          Chi ritira, e quali Ceste si porta via.
        </p>
      </div>
      <CampagnaBar />
      <RitiroFlow />
    </main>
  );
}
