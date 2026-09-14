import { redirect } from "next/navigation";
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
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 p-4 md:p-6 lg:max-w-4xl">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Ritiro
        </h1>
        <p className="text-muted-foreground">
          Chi ritira, e quali Ceste si porta via.
        </p>
      </div>
      <RitiroFlow />
    </main>
  );
}
