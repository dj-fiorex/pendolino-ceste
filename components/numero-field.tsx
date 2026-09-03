"use client";

import { useConvex } from "convex/react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import type { FoundCesta } from "@/lib/ceste";

/**
 * The numero of one Cesta as the counter types it: three digits on the
 * Etichetta, 17 or 017 at the keyboard. Every screen that works a Cesta at a
 * time asks for one here, so that the camera of #23 arrives in one place
 * rather than in each of them.
 *
 * A numero that answers to no Cesta is reported on the spot and nothing is
 * added (spec #1, story 57). Whatever the screen makes of the Cesta that does
 * answer it says on the same line, by handing back what to write — or nothing,
 * where there is nothing to say.
 */
export function NumeroField({
  label,
  submitLabel,
  onCesta,
}: {
  label: string;
  submitLabel: string;
  onCesta: (cesta: FoundCesta) => string | null;
}) {
  const convex = useConvex();
  const [numero, setNumero] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const typed = numero.trim();
    if (typed === "") {
      return;
    }
    const cesta = await convex.query(api.ceste.byNumero, { numero: typed });
    if (cesta === null) {
      setNotice(`Nessuna Cesta con il numero ${typed}.`);
      return;
    }
    setNumero("");
    setNotice(onCesta(cesta));
  };

  return (
    <form onSubmit={submit} className="grid gap-2">
      <Label htmlFor="numero">{label}</Label>
      <div className="flex gap-3">
        <Input
          id="numero"
          name="numero"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="17"
          value={numero}
          onChange={(event) => setNumero(event.target.value)}
          className="h-12 flex-1 text-base tabular-nums"
        />
        <Button type="submit" className="h-12 px-6 text-base">
          {submitLabel}
        </Button>
      </div>
      {notice !== null && (
        <p role="alert" className="text-sm text-destructive">
          {notice}
        </p>
      )}
    </form>
  );
}
