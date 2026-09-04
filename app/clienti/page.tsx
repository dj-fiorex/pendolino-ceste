import { redirect } from "next/navigation";
import { ClientiRegistry } from "@/components/clienti-registry";
import { signedInOperatore } from "@/lib/auth-server";

/** The registry: whoever takes Ceste away, and the way to each of them. */
export default async function Clienti() {
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
          I Clienti
        </h1>
        <p className="text-muted-foreground">
          Cerca per nome o per soprannome. Chi non c&apos;è si scrive al
          momento.
        </p>
      </div>
      <ClientiRegistry />
    </main>
  );
}
