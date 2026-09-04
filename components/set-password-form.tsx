"use client";

import { useAction, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { MIN_PASSWORD_LENGTH } from "@/convex/schema";
import { authClient } from "@/lib/auth-client";

/** What the screen says while it has nothing to say yet. */
function Waiting() {
  return <p className="text-sm text-muted-foreground">Un attimo…</p>;
}

/** A link that opens nothing, whatever the reason. */
function Spent({ why }: { why: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Questo link non vale più</CardTitle>
        <CardDescription>{why}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" asChild className="h-12 w-full text-base">
          <a href="/accedi">Vai alla pagina di accesso</a>
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * Where somebody chooses their own password: the invited person coming in for
 * the first time, and whoever forgot theirs and was sent a new link.
 *
 * The same screen for both, because it is the same act. Which of the two it is
 * changes only what it says at the top — and the link, which the mill emailed
 * and which is good once, is what says whose password is being set (#26).
 */
export function SetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const link = useQuery(api.accessLinks.byToken, { token });
  const accept = useAction(api.accounts.accept);
  const setPassword = useAction(api.accounts.setPassword);
  const [password, setPassword_] = useState("");
  const [again, setAgain] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (link === undefined) {
    return <Waiting />;
  }
  if (link === null) {
    return (
      <Spent why="Controlla di aver aperto l'ultimo link che ti è arrivato, oppure chiedine un altro a un Admin del frantoio." />
    );
  }
  if (link.used) {
    return (
      <Spent
        why={
          link.kind === "invitation"
            ? "L'invito è già stato accettato: entra con la tua email e la password che hai scelto."
            : "Questo link è già stato usato: entra con la password che hai scelto."
        }
      />
    );
  }
  // Only ever read after the query has answered, which is after this page has
  // hydrated: the server render never reaches the clock.
  if (link.expiresAt <= Date.now()) {
    return (
      <Spent why="Il link è scaduto. Chiedine un altro a un Admin del frantoio." />
    );
  }

  const tooShort = password.length < MIN_PASSWORD_LENGTH;
  const different = password !== again;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const chosen =
        link.kind === "invitation"
          ? await accept({ token, password })
          : await setPassword({ token, password });
      // The password was chosen a second ago on this very device: there is
      // nothing to ask again.
      const attempt = await authClient.signIn.email({
        email: chosen.email,
        password,
      });
      if (attempt.error) {
        router.replace("/accedi");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setPending(false);
      setError(
        "Non è stato possibile salvare la password. Riprova, o chiedi un altro link a un Admin.",
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ciao {link.name}</CardTitle>
        <CardDescription>
          {link.kind === "invitation"
            ? "Scegli la tua password: da qui in poi entri con questa e con la tua email."
            : "Scegli una nuova password per entrare."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              value={link.email}
              readOnly
              className="h-12 text-base"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword_(event.target.value)}
              required
              className="h-12 text-base"
            />
            <p className="text-sm text-muted-foreground">
              Almeno {MIN_PASSWORD_LENGTH} caratteri.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password-again">Ripeti la password</Label>
            <Input
              id="password-again"
              name="password-again"
              type="password"
              autoComplete="new-password"
              value={again}
              onChange={(event) => setAgain(event.target.value)}
              required
              className="h-12 text-base"
            />
          </div>
          {again !== "" && different && (
            <p role="alert" className="text-sm text-destructive">
              Le due password non sono uguali.
            </p>
          )}
          {error !== null && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={pending || tooShort || different}
            className="h-12 text-base"
          >
            {pending ? "Un attimo…" : "Entra"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
