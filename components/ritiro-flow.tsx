"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { useCampagnaChoice } from "@/components/campagna-bar";
import { CestaTile } from "@/components/cesta-tile";
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
 *
 * Variant B of the prototype the mill chose (#31), the same shape as the
 * Rientro: the Ceste of this Ritiro are tiles a tap takes back off, and the
 * numero and the confirmation sit together in the bar at the bottom, where the
 * camera docks beside them when #23 arrives.
 */
export function RitiroFlow() {
  const recordRitiro = useMutation(api.movimenti.ritiro);
  const { campagnaId, mustAsk } = useCampagnaChoice();
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
        campagnaId,
      });
      setDone({ cliente, count: ceste.length });
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-4 pb-4">
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

      <div className="flex items-baseline justify-between text-sm text-muted-foreground">
        <span>Questo Ritiro · tocca per togliere</span>
        <span>{cesteCount(ceste.length)}</span>
      </div>

      {ceste.length === 0 ? (
        <p className="text-muted-foreground">
          Scrivi il numero di ogni Cesta, una alla volta. Lo zero davanti non
          serve.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {ceste.map((cesta) => (
            <li key={cesta._id}>
              {/* Every tile here is a Cesta going out, so every one is filled:
                  a tap is what takes her back out of the Ritiro. */}
              <CestaTile
                codice={cesta.codice}
                selected
                onToggle={() =>
                  setCeste(ceste.filter((added) => added._id !== cesta._id))
                }
              />
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

      <div className="sticky bottom-4 grid gap-3 rounded-xl border bg-card p-3 shadow-lg">
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
        <Button
          className="h-14 w-full text-lg"
          disabled={pending || ceste.length === 0 || mustAsk}
          onClick={confirm}
        >
          {pending
            ? "Un attimo…"
            : mustAsk
              ? "Scegli prima la Campagna"
              : `Conferma Ritiro · ${cesteCount(ceste.length)}`}
        </Button>
      </div>
    </div>
  );
}
