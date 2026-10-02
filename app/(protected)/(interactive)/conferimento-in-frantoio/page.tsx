import { redirect } from "next/navigation";
import { IncomingCesteFlow } from "@/components/incoming-ceste-flow";
import { signedInOperatore } from "@/lib/auth-server";

export default async function ConferimentoInFrantoio() {
  const { signedIn, operatore } = await signedInOperatore();
  if (!signedIn) redirect("/accedi");
  if (operatore === null) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 p-4 md:p-6 lg:max-w-4xl">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Conferimento in frantoio
        </h1>
        <p className="text-muted-foreground">
          Chi porta le olive e in quali Ceste le deposita qui in frantoio.
        </p>
      </div>
      <IncomingCesteFlow kind="conferimento_in_frantoio" />
    </main>
  );
}
