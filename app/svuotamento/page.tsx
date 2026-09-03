import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CampagnaBar } from "@/components/campagna-bar";
import { SvuotamentoScreen } from "@/components/svuotamento-screen";
import { Button } from "@/components/ui/button";
import { signedInOperatore } from "@/lib/auth-server";

/**
 * The Svuotamento: where the Ceste are tipped out and their paper tapes come
 * off. Full width on both form factors, because the tablet the mill may buy for
 * this spot shows two columns of Cards where the phone shows one (#18, #30).
 */
export default async function Svuotamento() {
  const { signedIn, operatore } = await signedInOperatore();
  if (!signedIn) {
    redirect("/accedi");
  }
  if (operatore === null) {
    redirect("/");
  }

  return (
    <main className="flex min-h-dvh w-full flex-col gap-4 p-3 md:p-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" asChild className="size-12">
          <Link href="/" aria-label="Indietro">
            <ArrowLeftIcon className="size-5" />
          </Link>
        </Button>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Svuotamento
        </h1>
      </div>
      <CampagnaBar />
      <SvuotamentoScreen />
    </main>
  );
}
