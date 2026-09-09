import { redirect } from "next/navigation";
import { SignInForm } from "@/components/sign-in-form";
import { InstallButton } from "@/components/pwa-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signedInOperatore } from "@/lib/auth-server";

export default async function SignIn() {
  // Whoever already has an Operatore behind their session belongs on the home
  // screen; anyone else stays here, including an account the mill has since
  // deactivated.
  const { operatore } = await signedInOperatore();
  if (operatore !== null) {
    redirect("/");
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 p-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Pendolino Ceste
        </h1>
        <p className="text-muted-foreground">Le Ceste del frantoio.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Accedi</CardTitle>
          <CardDescription>
            Entra con la tua email per registrare i Movimenti della giornata.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm />
        </CardContent>
      </Card>
      <InstallButton />
    </main>
  );
}
