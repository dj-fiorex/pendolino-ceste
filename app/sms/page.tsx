import { redirect } from "next/navigation";
import { SmsAdmin } from "@/components/sms-admin";
import { signedInOperatore } from "@/lib/auth-server";

/**
 * Gli SMS: cosa dicono i due messaggi automatici, se partono, e quelli già
 * partiti.
 *
 * An Admin's, like everything that settles what the whole mill does rather
 * than what happened at the counter today (CONTEXT.md) — and refused to
 * everybody else by the mutations themselves, not by this redirect.
 */
export default async function Sms() {
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
          Gli SMS
        </h1>
        <p className="text-muted-foreground">
          Cosa scriviamo ai Clienti quando ritirano e quando riportano. Chi non
          li vuole si toglie dalla sua scheda.
        </p>
      </div>
      <SmsAdmin />
    </main>
  );
}
