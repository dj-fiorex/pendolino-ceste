"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { CesteLoad } from "@/components/ceste-load";
import { ClienteCard } from "@/components/cliente-card";
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
 * The Rientro: nobody is searched for. The Operatore reads the numero off any
 * one Cesta of the load and the app says whose it is; from there it is the same
 * counter as a Ritiro, and what is added is what comes back — the rest stay
 * Fuori and stay counted against the Cliente (#17).
 */
export function RientroFlow() {
  const recordRientro = useMutation(api.movimenti.rientro);
  // The one Cesta the load was identified by, while the app is still waiting to
  // be told whose the load is.
  const [identifiedBy, setIdentifiedBy] = useState<FoundCesta | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  // The Cliente is being looked up rather than read off a Cesta: either the
  // app had nobody to name, or the Operatore said it is somebody else.
  const [searching, setSearching] = useState(false);
  const [ceste, setCeste] = useState<FoundCesta[]>([]);
  const [done, setDone] = useState<{ cliente: Cliente; count: number } | null>(
    null,
  );

  /** The load is settled on a Cliente, and the Cesta it was found by opens it. */
  const openLoadFor = (whoIsHere: Cliente) => {
    setCliente(whoIsHere);
    setCeste(identifiedBy === null ? [] : [identifiedBy]);
    setIdentifiedBy(null);
    setSearching(false);
  };

  if (done !== null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rientro registrato</CardTitle>
          <CardDescription>
            {cesteCount(done.count)} da {clienteLabel(done.cliente)}, in attesa
            di molitura.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button
            className="h-12 text-base"
            onClick={() => {
              setDone(null);
              setCliente(null);
              setCeste([]);
            }}
          >
            Nuovo Rientro
          </Button>
          <Button variant="outline" asChild className="h-12 text-base">
            <Link href="/attesa-molitura">Vedi l&apos;Attesa molitura</Link>
          </Button>
          <Button variant="outline" asChild className="h-12 text-base">
            <Link href="/">Torna all&apos;inizio</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // The load is open and its Cliente is being changed: the Ceste already added
  // stay where they are, since it is the name that was wrong and not them.
  if (cliente !== null && searching) {
    return (
      <ClientePicker
        pickLabel="Rientro"
        onPick={(picked) => {
          setCliente(picked);
          setSearching(false);
        }}
      />
    );
  }

  if (cliente !== null) {
    return (
      <div className="grid gap-6">
        <ClienteCard cliente={cliente} onChange={() => setSearching(true)} />
        <CesteLoad
          movimento="rientro"
          ceste={ceste}
          onChange={setCeste}
          onConfirm={async () => {
            await recordRientro({
              clienteId: cliente._id,
              cesteIds: ceste.map((cesta) => cesta._id),
            });
            setDone({ cliente, count: ceste.length });
          }}
        />
      </div>
    );
  }

  // The Cesta names a Cliente: the Operatore reads the name off the screen,
  // looks at whoever is at the counter, and says yes or looks them up instead.
  if (identifiedBy !== null && identifiedBy.cliente !== null && !searching) {
    const holder = identifiedBy.cliente;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-display tabular-nums">
            {identifiedBy.codice}
          </CardTitle>
          <CardDescription>
            Questa Cesta risulta a {clienteLabel(holder)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button
            className="h-12 text-base"
            onClick={() => openLoadFor(holder)}
          >
            Rientro di {clienteLabel(holder)}
          </Button>
          <Button
            variant="outline"
            className="h-12 text-base"
            onClick={() => setSearching(true)}
          >
            È un altro Cliente
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Nobody to read off the Cesta, so the Cliente is searched for as at a Ritiro
  // (#16). What the app believed instead is #21's to record.
  if (identifiedBy !== null) {
    return (
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-display tabular-nums">
              {identifiedBy.codice}
            </CardTitle>
            <CardDescription>
              {identifiedBy.cliente === null
                ? "L'app non sa di chi sia questa Cesta. Cerca chi la sta riportando."
                : "Cerca chi sta riportando le Ceste."}
            </CardDescription>
          </CardHeader>
        </Card>
        <ClientePicker pickLabel="Rientro" onPick={openLoadFor} />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <NumeroField
        label="Numero di una Cesta del carico"
        submitLabel="Cerca"
        onCesta={(cesta) => {
          setIdentifiedBy(cesta);
          return null;
        }}
      />
      <p className="text-muted-foreground">
        Basta una Cesta qualsiasi del carico: l&apos;app dice di chi è, e il
        resto si aggiunge dopo.
      </p>
    </div>
  );
}
