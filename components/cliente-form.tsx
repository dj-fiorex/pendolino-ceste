"use client";

import { useQuery } from "convex/react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { namesakeClash } from "@/convex/schema";
import { clienteLabel, readAlias, type Cliente } from "@/lib/cliente";

/** What the form holds, which is everything a Cliente is at the counter. */
export type ClienteFields = { name: string; alias: string[]; phone: string };

const EMPTY: ClienteFields = { name: "", alias: [], phone: "" };

/**
 * A Cliente being written down: the name, and whatever else they offer while
 * the queue waits. A name is enough.
 *
 * The form watches the registry as the name is typed and says so when somebody
 * of that name is already there — offering them, since a returning Cliente
 * must never get a second record (spec #1, story 59). A real namesake is told
 * apart by a Soprannome; the mutation refuses the rest.
 */
export function ClienteForm({
  initial = EMPTY,
  cliente = null,
  submitLabel,
  onSubmit,
  onPickNamesake,
  onCancel,
}: {
  initial?: ClienteFields;
  /** The Cliente being corrected, who is never their own namesake. */
  cliente?: Cliente | null;
  submitLabel: string;
  onSubmit: (fields: ClienteFields) => Promise<void>;
  /** Offers a namesake for selection, where there is somewhere to send them. */
  onPickNamesake?: (namesake: Cliente) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [alias, setAlias] = useState(initial.alias.join(", "));
  const [phone, setPhone] = useState(initial.phone);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typedAlias = readAlias(alias);
  const found = useQuery(api.clienti.namesakes, { name });
  // The Cliente being corrected is never their own namesake.
  const namesakes = (found ?? []).filter((other) => other._id !== cliente?._id);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim() === "") {
      setError("Scrivi il nome del Cliente.");
      return;
    }
    if (found === undefined) {
      // Nothing is saved before the registry has said whether the name is
      // taken: the Operatore is offered whoever is already there instead.
      setError("Un attimo, sto controllando il nome…");
      return;
    }
    switch (namesakeClash(typedAlias, namesakes)) {
      case "no_alias":
        setError(
          "C'è già un Cliente con questo nome. Scegli quello, oppure aggiungi un Soprannome per distinguerli.",
        );
        return;
      case "shared_alias":
        setError(
          "Il Cliente con lo stesso nome ha già questo Soprannome: così non si distinguono.",
        );
        return;
    }
    setError(null);
    setPending(true);
    try {
      await onSubmit({ name, alias: typedAlias, phone });
    } catch {
      setError(
        "Non è stato possibile salvare. Se un altro Cliente ha già questo nome, distinguilo con un Soprannome.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="cliente-name">Nome</Label>
        <Input
          id="cliente-name"
          name="name"
          autoComplete="off"
          autoCapitalize="words"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-12 text-base"
        />
      </div>

      {namesakes.length > 0 && (
        <div className="grid gap-2 rounded-lg border border-primary bg-secondary p-3">
          <p className="text-sm font-semibold text-secondary-foreground">
            {namesakes.length === 1
              ? "C'è già un Cliente con questo nome"
              : "Ci sono già Clienti con questo nome"}
          </p>
          <ul className="grid gap-2">
            {namesakes.map((namesake) => (
              <li key={namesake._id}>
                {/* A deactivated Cliente is nobody's to pick: they are here to
                    explain why a Soprannome is needed (ADR-0004). */}
                {onPickNamesake === undefined || !namesake.active ? (
                  <p className="text-sm">
                    {clienteLabel(namesake)}
                    {namesake.active ? "" : " · disattivato"}
                  </p>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full justify-start text-base"
                    onClick={() => onPickNamesake(namesake)}
                  >
                    {clienteLabel(namesake)}
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Se è la stessa persona scegli quella. Se no, scrivi un Soprannome
            per distinguerli.
          </p>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="cliente-alias">Soprannomi</Label>
        <Input
          id="cliente-alias"
          name="alias"
          autoComplete="off"
          value={alias}
          onChange={(event) => setAlias(event.target.value)}
          className="h-12 text-base"
        />
        <p className="text-sm text-muted-foreground">
          Se ne ha più di uno, separali con una virgola.
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="cliente-phone">Telefono</Label>
        <Input
          id="cliente-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="h-12 text-base"
        />
      </div>

      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-3">
        <Button type="submit" disabled={pending} className="h-12 text-base">
          {pending ? "Un attimo…" : submitLabel}
        </Button>
        {onCancel !== undefined && (
          <Button
            type="button"
            variant="outline"
            className="h-12 text-base"
            onClick={onCancel}
          >
            Annulla
          </Button>
        )}
      </div>
    </form>
  );
}
