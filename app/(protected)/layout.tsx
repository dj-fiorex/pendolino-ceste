import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { api } from "@/convex/_generated/api";
import {
  preloadAuthQuery,
  preloadOperatore,
  signedInOperatore,
} from "@/lib/auth-server";

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { signedIn, operatore } = await signedInOperatore();
  if (!signedIn) redirect("/accedi");

  const preloadedOperatore = await preloadOperatore();
  const preloadedCampagne = operatore
    ? await preloadAuthQuery(api.campagne.list, {})
    : null;

  return (
    <AppShell
      preloadedOperatore={preloadedOperatore}
      preloadedCampagne={preloadedCampagne}
    >
      {children}
    </AppShell>
  );
}
