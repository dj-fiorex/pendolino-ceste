"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
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
import type { Forma, Portata } from "@/convex/schema";
import { cn } from "@/lib/utils";

const PORTATE: { value: Portata; label: string }[] = [
  { value: 400, label: "400 kg" },
  { value: 250, label: "250 kg" },
];

const FORME: { value: Forma; label: string }[] = [
  { value: "rettangolare", label: "Rettangolare" },
  { value: "quadrata", label: "Quadrata" },
];

/** What a Censimento just produced: how many Ceste, and the run of numeri. */
type Censimento = { count: number; fromNumero: number; toNumero: number };

const optionClass = (selected: boolean) =>
  cn(
    "h-14 flex-1 rounded-lg border text-base font-semibold transition-colors",
    selected
      ? "border-primary bg-primary text-primary-foreground"
      : "bg-card hover:bg-accent",
  );

/**
 * A Censimento: how many Ceste of which Portata and Forma. On the way out it
 * offers the Ceste just entered, so that their Etichette can be printed.
 */
export function CensimentoForm() {
  const runCensimento = useMutation(api.ceste.censimento);
  const [portata, setPortata] = useState<Portata>(400);
  const [forma, setForma] = useState<Forma>("rettangolare");
  const [count, setCount] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [censimento, setCensimento] = useState<Censimento | null>(null);

  if (censimento !== null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {censimento.count === 1
              ? "1 Cesta censita"
              : `${censimento.count} Ceste censite`}
          </CardTitle>
          <CardDescription>
            {censimento.fromNumero === censimento.toNumero
              ? `Numero ${censimento.fromNumero}. Ora serve l'Etichetta.`
              : `Dal numero ${censimento.fromNumero} al numero ${censimento.toNumero}. Ora servono le Etichette.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button asChild className="h-12 text-base">
            <Link
              href={`/ceste/etichette?from=${censimento.fromNumero}&to=${censimento.toNumero}`}
            >
              Stampa le Etichette
            </Link>
          </Button>
          <Button
            variant="outline"
            className="h-12 text-base"
            onClick={() => {
              setCount("");
              setCensimento(null);
            }}
          >
            Fai un altro Censimento
          </Button>
        </CardContent>
      </Card>
    );
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requested = Number(count);
    if (!Number.isInteger(requested) || requested < 1) {
      setError("Scrivi quante Ceste stai censendo.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const range = await runCensimento({
        portata,
        forma,
        count: requested,
      });
      setCensimento({ ...range, count: requested });
    } catch {
      setError(
        "Non è stato possibile fare il Censimento. Controlla quante Ceste hai scritto e riprova.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-6">
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Portata</legend>
        <div className="flex gap-3">
          {PORTATE.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={portata === option.value}
              onClick={() => setPortata(option.value)}
              className={optionClass(portata === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Forma</legend>
        <div className="flex gap-3">
          {FORME.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={forma === option.value}
              onClick={() => setForma(option.value)}
              className={optionClass(forma === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-2">
        <Label htmlFor="count">Quante Ceste</Label>
        <Input
          id="count"
          name="count"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          required
          value={count}
          onChange={(event) => setCount(event.target.value)}
          className="h-12 text-base"
        />
      </div>

      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="h-12 text-base">
        {pending ? "Un attimo…" : "Fai il Censimento"}
      </Button>
    </form>
  );
}
