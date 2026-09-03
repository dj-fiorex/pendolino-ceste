import Link from "next/link";
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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-6">
      <div className="space-y-2">
        <Link
          href="/"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Indietro
        </Link>
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
