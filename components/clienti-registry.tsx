"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientePicker } from "@/components/cliente-picker";
import { Button } from "@/components/ui/button";

/**
 * The registry as a screen of its own: the same search the counter uses, and
 * the way to a Cliente's page to correct them or to deactivate them.
 */
export function ClientiRegistry() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            I Clienti
          </h1>
          <Button
            type="button"
            variant="outline"
            className="h-12 text-base"
            disabled={creating}
            onClick={() => setCreating(true)}
          >
            Nuovo Cliente
          </Button>
        </div>
        <p className="text-muted-foreground">
          Cerca per nome o per soprannome. Chi non c&apos;è si scrive al
          momento.
        </p>
      </div>
      <ClientePicker
        pickLabel="Apri"
        creating={creating}
        onCreatingChange={setCreating}
        showCreateAction={false}
        onPick={(cliente) => router.push(`/clienti/${cliente._id}`)}
      />
    </div>
  );
}
