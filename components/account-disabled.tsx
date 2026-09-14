import { SignOutButton } from "@/components/sign-out-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AccountDisabled() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col justify-center gap-8 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Questo account non è abilitato</CardTitle>
          <CardDescription>
            Chiedi a un Admin del frantoio di riattivarti, poi rientra.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutButton />
        </CardContent>
      </Card>
    </main>
  );
}
