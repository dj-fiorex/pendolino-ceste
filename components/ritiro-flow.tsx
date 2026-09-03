"use client";

import { useMutation } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { CesteLoad } from "@/components/ceste-load";
import { ClienteCard } from "@/components/cliente-card";
import { ClientePicker } from "@/components/cliente-picker";
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

  return (
    <div className="grid gap-6">
      <ClienteCard cliente={cliente} onChange={() => setCliente(null)} />
      <CesteLoad
        movimento="ritiro"
        ceste={ceste}
        onChange={setCeste}
        onConfirm={async () => {
          await recordRitiro({
            clienteId: cliente._id,
            cesteIds: ceste.map((cesta) => cesta._id),
          });
          setDone({ cliente, count: ceste.length });
        }}
      />
    </div>
  );
}
