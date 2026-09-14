import { redirect } from "next/navigation";
import { FrantoioAdmin } from "@/components/frantoio-admin";
import { signedInOperatore } from "@/lib/auth-server";

/**
 * Il frantoio: come ci chiamiamo, come ci si trova, da chi arrivano i nostri
 * SMS, e dopo quanti giorni una Cesta è In ritardo.
 *
 * An Admin's, like everything that settles what the whole mill does rather
 * than what happened at the counter today (CONTEXT.md) — and refused to
 * everybody else by the mutations themselves, not by this redirect.
 */
export default async function Frantoio() {
  const { signedIn, operatore } = await signedInOperatore();
  if (!signedIn) {
    redirect("/accedi");
  }
  if (operatore === null || operatore.role !== "admin") {
    redirect("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 p-4 md:p-6 lg:max-w-2xl">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Il frantoio
        </h1>
        <p className="text-muted-foreground">
          Quello che il frantoio ha deciso su sé stesso: vale per ogni Etichetta
          che stampiamo e per ogni SMS che mandiamo.
        </p>
      </div>
      <FrantoioAdmin />
    </main>
  );
}
