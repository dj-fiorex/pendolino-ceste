"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClienteForm } from "@/components/cliente-form";
import { SmsComposer } from "@/components/sms-composer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/convex/_generated/api";
import { cesteCount } from "@/lib/ceste";
import type { Cliente } from "@/lib/cliente";

/**
 * What an Operatore does with a Cliente: correct the name, the Soprannomi or
 * the telephone, which every Operatore may (spec #1, story 53).
 *
 * Deactivating is an Admin's, and an Admin holding somebody's Ceste is shown
 * exactly which ones before they go ahead: the Cliente stays on the Lista di
 * recupero with them (ADR-0004, #22). So is writing to them by hand: free
 * words going out over the mill's name are a different power from recording a
 * Ritiro.
 */
export function ClienteDetail({
  cliente,
  codiciFuori,
  isAdmin,
}: {
  cliente: Cliente & { active: boolean };
  codiciFuori: string[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const updateCliente = useMutation(api.clienti.update);
  const deactivateCliente = useMutation(api.clienti.deactivate);
  const [correcting, setCorrecting] = useState(false);
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (correcting) {
    return (
      <ClienteForm
        cliente={cliente}
        initial={{
          name: cliente.name,
          alias: cliente.alias,
          phone: cliente.phone ?? "",
          smsOptOut: cliente.smsOptOut,
        }}
        submitLabel="Salva"
        onCancel={() => setCorrecting(false)}
        onSubmit={async (fields) => {
          await updateCliente({ clienteId: cliente._id, ...fields });
          setCorrecting(false);
          router.refresh();
        }}
      />
    );
  }

  const deactivate = async () => {
    setError(null);
    setPending(true);
    try {
      await deactivateCliente({ clienteId: cliente._id, confirmed: true });
      setAsking(false);
      router.refresh();
    } catch {
      setError("Non è stato possibile disattivare il Cliente. Riprova.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid gap-3">
      {isAdmin && cliente.phone !== null && (
        <SmsComposer cliente={cliente} className="h-12 text-base" />
      )}

      <Button
        variant="outline"
        className="h-12 text-base"
        onClick={() => setCorrecting(true)}
      >
        Correggi il Cliente
      </Button>

      {isAdmin &&
        cliente.active &&
        (asking ? (
          <Card>
            <CardHeader>
              <CardTitle>Disattivare {cliente.name}?</CardTitle>
              <CardDescription>
                {codiciFuori.length === 0
                  ? "Non comparirà più nelle ricerche. Resta nel Registro e nei Movimenti già fatti."
                  : `Ha ancora ${cesteCount(codiciFuori.length)} Fuori: ${codiciFuori.join(", ")}. Resta nella Lista di recupero finché non rientrano.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button
                variant="destructive"
                className="h-12 text-base"
                disabled={pending}
                onClick={deactivate}
              >
                {pending ? "Un attimo…" : "Disattiva comunque"}
              </Button>
              <Button
                variant="outline"
                className="h-12 text-base"
                onClick={() => setAsking(false)}
              >
                Annulla
              </Button>
              {error !== null && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Button
            variant="outline"
            className="h-12 text-base"
            onClick={() => setAsking(true)}
          >
            Disattiva il Cliente
          </Button>
        ))}
    </div>
  );
}
