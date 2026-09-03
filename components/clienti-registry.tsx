"use client";

import { useRouter } from "next/navigation";
import { ClientePicker } from "@/components/cliente-picker";

/**
 * The registry as a screen of its own: the same search the counter uses, and
 * the way to a Cliente's page to correct them or to deactivate them.
 */
export function ClientiRegistry() {
  const router = useRouter();

  return (
    <ClientePicker
      pickLabel="Apri"
      onPick={(cliente) => router.push(`/clienti/${cliente._id}`)}
    />
  );
}
