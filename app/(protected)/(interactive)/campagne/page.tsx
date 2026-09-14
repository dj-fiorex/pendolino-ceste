import { redirect } from "next/navigation";
import { CampagneAdmin } from "@/components/campagne-admin";
import { signedInOperatore } from "@/lib/auth-server";

/**
 * The Campagne: the mill's seasons, opened at the start and closed at the end.
 * An Admin's, like everything that acts on the Campagne rather than on the
 * day's movements (CONTEXT.md) — and refused to everybody else by the
 * mutations themselves, not by this redirect.
 */
export default async function Campagne() {
  const { signedIn, operatore } = await signedInOperatore();
  if (!signedIn) {
    redirect("/accedi");
  }
  if (operatore === null || operatore.role !== "admin") {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 p-4 md:p-6 lg:max-w-4xl">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Le Campagne
        </h1>
        <p className="text-muted-foreground">
          La stagione a cui appartiene quello che si registra al banco.
          Chiuderla non sposta nessuna Cesta.
        </p>
      </div>
      <CampagneAdmin />
    </main>
  );
}
