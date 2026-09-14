import type { ReactNode } from "react";
import { ConvexAuthGate } from "@/components/convex-auth-gate";

export default function InteractiveLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ConvexAuthGate>{children}</ConvexAuthGate>;
}
