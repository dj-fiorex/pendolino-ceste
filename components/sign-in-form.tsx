"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function SignInForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setError(null);
    setPending(true);
    const attempt = await authClient.signIn.email({
      email: String(fields.get("email") ?? ""),
      password: String(fields.get("password") ?? ""),
    });
    if (attempt.error) {
      setPending(false);
      setError(
        attempt.error.code === "INVALID_EMAIL_OR_PASSWORD"
          ? "Email o password non corretti."
          : attempt.error.code === "INVALID_ORIGIN"
            ? "Questo indirizzo del sito non è abilitato all'accesso. Contatta un Admin."
            : "Accesso non riuscito. Riprova tra poco.",
      );
      return;
    }
    router.replace("/");
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          required
          className="h-12 text-base"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 text-base"
        />
      </div>
      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-12 text-base">
        {pending ? "Un attimo…" : "Entra"}
      </Button>
    </form>
  );
}
