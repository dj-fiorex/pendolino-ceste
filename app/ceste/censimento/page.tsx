import Link from "next/link";
import { redirect } from "next/navigation";
import { CensimentoForm } from "@/components/censimento-form";
import { signedInOperatore } from "@/lib/auth-server";

/** The Censimento screen. Entering Ceste is an Admin's act (spec #1). */
export default async function Censimento() {
  const { signedIn, operatore } = await signedInOperatore();
  if (!signedIn) {
    redirect("/accedi");
  }
  if (operatore === null || operatore.role !== "admin") {
    redirect("/ceste");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-6">
      <div className="space-y-2">
        <Link
          href="/ceste"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Le Ceste
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Censimento
        </h1>
        <p className="text-muted-foreground">
          Ceste tutte della stessa Portata e della stessa Forma. Il numero e il
          Codice li dà l&apos;app, una volta sola: finiscono stampati
          sull&apos;Etichetta.
        </p>
      </div>
      <CensimentoForm />
    </main>
  );
}
