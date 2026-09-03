"use client";

import { useConvex, useMutation } from "convex/react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ClientePicker } from "@/components/cliente-picker";
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
import type { Id } from "@/convex/_generated/dataModel";
import { cesteCount } from "@/lib/ceste";
import { clienteLabel, type Cliente } from "@/lib/cliente";

/** A Cesta on the running list, as she was added. */
type AddedCesta = {
  _id: Id<"ceste">;
  numero: number;
  codice: string;
  portata: number;
};

/**
 * The counter: the Cliente in front of the Operatore, then their Ceste one at
 * a time, then the Ritiro. The camera arrives with #23 — a typed numero and a
 * scanned QR are the same input, so this is the whole movement with the
 * keyboard.
 */
export function RitiroFlow() {
  const convex = useConvex();
  const recordRitiro = useMutation(api.movimenti.ritiro);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [ceste, setCeste] = useState<AddedCesta[]>([]);
  const [numero, setNumero] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
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
              setNumero("");
              setNotice(null);
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

  const addCesta = async (event: FormEvent<HTMLFormElement>) => {
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
    if (ceste.some((added) => added._id === cesta._id)) {
      setNotice(`${cesta.codice} è già nell'elenco.`);
      return;
    }
    setNotice(null);
    setCeste([...ceste, cesta]);
  };

  const confirm = async () => {
    setPending(true);
    try {
      await recordRitiro({
        clienteId: cliente._id,
        cesteIds: ceste.map((cesta) => cesta._id),
      });
      setDone({ cliente, count: ceste.length });
    } catch {
      setNotice(
        "Non è stato possibile registrare il Ritiro. Controlla la connessione e riprova.",
      );
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

      <form onSubmit={addCesta} className="grid gap-2">
        <Label htmlFor="numero">Numero della Cesta</Label>
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
            Aggiungi
          </Button>
        </div>
      </form>

      {notice !== null && (
        <p role="alert" className="text-sm text-destructive">
          {notice}
        </p>
      )}

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
