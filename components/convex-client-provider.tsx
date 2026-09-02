"use client";

import {
  ConvexBetterAuthProvider,
  type AuthClient,
} from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({
  children,
  initialToken,
}: {
  children: ReactNode;
  initialToken: string | null;
}) {
  return (
    <ConvexBetterAuthProvider
      client={convex}
      // The provider's AuthClient type was inferred against better-auth
      // 1.6.15; from 1.6.22 on — the versions carrying the fix for
      // GHSA-qq9h-g4jm-xgf3 — its `useSession().data` collapses to `never`, so
      // no client satisfies it. The runtime contract is unchanged, and this is
      // the one place that has to say so.
      authClient={authClient as unknown as AuthClient}
      initialToken={initialToken}
    >
      {children}
    </ConvexBetterAuthProvider>
  );
}
