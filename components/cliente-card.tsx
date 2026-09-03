"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { clienteLabel, type Cliente } from "@/lib/cliente";

/**
 * Who is at the counter, above the Ceste being counted onto their trailer or
 * off it: the same card over a Ritiro and over a Rientro, and the way back to
 * the search when it is somebody else.
 */
export function ClienteCard({
  cliente,
  onChange,
}: {
  cliente: Cliente;
  onChange: () => void;
}) {
  return (
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
          onClick={onChange}
        >
          Cambia Cliente
        </Button>
      </CardContent>
    </Card>
  );
}
