import Link from "next/link";
import { redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { fetchAuthQuery, signedInOperatore } from "@/lib/auth-server";
import { cesteCount } from "@/lib/ceste";
import { clienteLabel } from "@/lib/cliente";

/**
 * The Ceste back at the mill and still full: what the app believes is waiting
 * to be milled, read against the paper tapes on the Ceste themselves.
 *
 * A flat list by numero, because that is how the yard is walked. Emptying them
 * from here — the tiles, grouped by Cliente, for hands that have been in the
 * olives — is #18's.
 */
export default async function AttesaMolitura() {
  const { signedIn, operatore } = await signedInOperatore();
  if (!signedIn) {
    redirect("/accedi");
  }
  if (operatore === null) {
    redirect("/");
  }

  const ceste = await fetchAuthQuery(api.ceste.attesaMolitura, {});

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
          Attesa molitura
        </h1>
        <p className="text-muted-foreground">
          {ceste.length === 0
            ? "Al frantoio, piene, da svuotare."
            : `${cesteCount(ceste.length)} tornate piene, da svuotare.`}
        </p>
      </div>

      {ceste.length === 0 ? (
        <p className="text-muted-foreground">
          Nessuna Cesta in attesa di molitura.
        </p>
      ) : (
        <ul className="grid gap-2">
          {ceste.map((cesta) => (
            <li
              key={cesta._id}
              className="flex items-baseline gap-3 rounded-lg border bg-card px-4 py-3"
            >
              <span className="font-display text-lg font-bold tabular-nums">
                {cesta.codice}
              </span>
              <span className="flex-1 text-sm text-muted-foreground">
                {cesta.cliente === null
                  ? "Senza Cliente"
                  : clienteLabel(cesta.cliente)}
              </span>
              <span className="text-sm text-muted-foreground">
                {cesta.portata} kg
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
