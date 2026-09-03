import Link from "next/link";
import { redirect } from "next/navigation";
import { RegistroList } from "@/components/registro-list";
import { todayAtTheMill } from "@/convex/schema";
import { signedInOperatore } from "@/lib/auth-server";

/**
 * The Registro: who did what, when, and what it changed. Reserved to an Admin,
 * who is the only one it is for (CONTEXT.md) — and refused to everybody else by
 * the queries themselves, not by this redirect.
 */
export default async function Registro() {
  const { signedIn, operatore } = await signedInOperatore();
  if (!signedIn) {
    redirect("/accedi");
  }
  if (operatore === null || operatore.role !== "admin") {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 p-6">
      <div className="space-y-2">
        <Link
          href="/"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Indietro
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Il Registro
        </h1>
        <p className="text-muted-foreground">
          Tutto quello che è stato fatto, giorno per giorno.
        </p>
      </div>

      {/* The day the screen opens on is settled here, so that the first render
          and the one that hydrates it agree on today. */}
      <RegistroList initialDay={todayAtTheMill()} />
    </main>
  );
}
