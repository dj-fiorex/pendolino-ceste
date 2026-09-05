"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { ClienteForm } from "@/components/cliente-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/convex/_generated/api";
import { storedPhone } from "@/convex/phone";
import { MAX_SEARCH_RESULTS } from "@/convex/schema";
import { clienteLabel, type Cliente } from "@/lib/cliente";

/**
 * Finding whoever is at the counter: search by name or by Soprannome, and
 * enter them on the spot when they have never been here before. Both the
 * Ritiro and the registry start here, and either way the answer is one Cliente.
 */
export function ClientePicker({
  onPick,
  pickLabel,
}: {
  onPick: (cliente: Cliente) => void;
  /** What choosing a Cliente does next, for whoever reads the screen. */
  pickLabel: string;
}) {
  const [term, setTerm] = useState("");
  const [writing, setWriting] = useState(false);
  const createCliente = useMutation(api.clienti.create);
  const found = useQuery(api.clienti.search, { term });

  if (writing) {
    return (
      <ClienteForm
        initial={{ name: term, alias: [], phone: "", smsOptOut: false }}
        submitLabel="Crea il Cliente"
        onPickNamesake={onPick}
        onCancel={() => setWriting(false)}
        onSubmit={async (fields) => {
          // A Cliente entered at the counter receives the mill's SMS: nobody
          // has asked not to yet, and the switch that says so is on their own
          // page rather than on this form.
          const clienteId = await createCliente({
            name: fields.name,
            alias: fields.alias,
            phone: fields.phone,
          });
          onPick({
            _id: clienteId,
            name: fields.name.trim(),
            alias: fields.alias,
            // As the registry now keeps it, not as it was typed (ADR-0009).
            phone: storedPhone(fields.phone),
            smsOptOut: false,
          });
        }}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="cliente-search">Cerca il Cliente</Label>
        <Input
          id="cliente-search"
          name="term"
          type="search"
          autoComplete="off"
          placeholder="Nome o soprannome"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          className="h-12 text-base"
        />
      </div>

      {found === undefined ? (
        <p className="text-sm text-muted-foreground">Un attimo…</p>
      ) : found.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nessun Cliente con questo nome.
        </p>
      ) : (
        <ul className="grid gap-2">
          {found.map((cliente) => (
            <li key={cliente._id}>
              <button
                type="button"
                aria-label={`${pickLabel}: ${clienteLabel(cliente)}`}
                onClick={() => onPick(cliente)}
                className="w-full rounded-lg border bg-card px-4 py-3 text-left transition-colors hover:bg-accent"
              >
                <p className="font-display text-lg font-bold">
                  {clienteLabel(cliente)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {cliente.phone ?? "Telefono non lo sappiamo"}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {found !== undefined && found.length === MAX_SEARCH_RESULTS && (
        <p className="text-sm text-muted-foreground">
          Ce ne sono altri: scrivi qualche lettera in più.
        </p>
      )}

      <Button
        variant="outline"
        className="h-12 text-base"
        onClick={() => setWriting(true)}
      >
        Nuovo Cliente
      </Button>
    </div>
  );
}
