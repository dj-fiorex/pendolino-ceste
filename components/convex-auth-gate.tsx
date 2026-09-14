"use client";

import { useConvexAuth } from "convex/react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

/** Only screens that issue ordinary client queries wait for the connection. */
export function ConvexAuthGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  if (isLoading) {
    return (
      <main className="p-6">
        <p role="status" className="text-sm text-muted-foreground">
          Un attimo…
        </p>
      </main>
    );
  }
  if (!isAuthenticated) redirect("/accedi");
  return children;
}
