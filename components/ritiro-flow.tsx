"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { ClientePicker } from "@/components/cliente-picker";
import { NumeroField } from "@/components/numero-field";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { cesteCount, type FoundCesta } from "@/lib/ceste";
import { clienteLabel, type Cliente } from "@/lib/cliente";

/**
 * The counter: the Cliente in front of the Operatore, then their Ceste one at
 * a time, then the Ritiro.
 */
export function RitiroFlow() {
  const recordRitiro = useMutation(api.movimenti.ritiro);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [ceste, setCeste] = useState<FoundCesta[]>([]);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{ cliente: Cliente; count: number } | null>(
    null,
  );

  if (done !== null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ritiro registrato</CardTitle>
          <CardDescription>
            {cesteCount(done.count)} a {clienteLabel(done.cliente)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button
            className="h-12 text-base"
            onClick={() => {
              setDone(null);
              setCliente(null);
              setCeste([]);
              setFailed(false);
            }}
          >
            Nuovo Ritiro
          </Button>
          <Button variant="outline" asChild className="h-12 text-base">
            <Link href="/">Torna all&apos;inizio</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (cliente === null) {
    return <ClientePicker onPick={setCliente} pickLabel="Ritiro" />;
  }

  const confirm = async () => {
    setPending(true);
    setFailed(false);
    try {
      await recordRitiro({
        clienteId: cliente._id,
        cesteIds: ceste.map((cesta) => cesta._id),
      });
      setDone({ cliente, count: ceste.length });
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{clienteLabel(cliente)}</CardTitle>
          <CardDescription>
            {cliente.phone ?? "Telefono non lo sappiamo"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="h-11 w-full text-base"
            onClick={() => setCliente(null)}
          >
            Cambia Cliente
          </Button>
        </CardContent>
      </Card>

      <NumeroField
        label="Numero della Cesta"
        submitLabel="Aggiungi"
        onCesta={(cesta) => {
          // The same Cesta added twice — typed after being scanned, say — is
          // the one Cesta she already was, and saying so is all that is left.
          if (ceste.some((added) => added._id === cesta._id)) {
            return `${cesta.codice} è già nell'elenco.`;
          }
          setCeste([...ceste, cesta]);
          return null;
        }}
      />

      {ceste.length === 0 ? (
        <p className="text-muted-foreground">
          Scrivi il numero di ogni Cesta, una alla volta. Lo zero davanti non
          serve.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2">
          {ceste.map((cesta) => (
            <li key={cesta._id}>
              <button
                type="button"
                aria-label={`Togli la Cesta ${cesta.codice}`}
                onClick={() =>
                  setCeste(ceste.filter((added) => added._id !== cesta._id))
                }
                className="flex h-24 w-full flex-col items-center justify-center rounded-lg border border-primary bg-secondary text-secondary-foreground transition-colors hover:bg-accent"
              >
                <span className="font-display text-lg font-bold tabular-nums">
                  {cesta.codice}
                </span>
                <span className="text-sm text-muted-foreground">
                  {cesta.portata} kg
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {failed && (
        <p role="alert" className="text-sm text-destructive">
          Non è stato possibile registrare il Ritiro. Controlla la connessione e
          riprova.
        </p>
      )}

      {ceste.length > 0 && (
        <div className="sticky bottom-4 rounded-xl border bg-card p-3 shadow-lg">
          <Button
            className="h-12 w-full text-base"
            disabled={pending}
            onClick={confirm}
          >
            {pending
              ? "Un attimo…"
              : `Conferma Ritiro · ${cesteCount(ceste.length)}`}
          </Button>
        </div>
      )}
    </div>
  );
}
