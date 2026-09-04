import type { Role } from "@/convex/schema";

/**
 * What a role is called on screen. An Admin is an Operatore who can act on the
 * fleet, the registry, the Campagne and the staff as well (CONTEXT.md), so the
 * two are one list everywhere the mill's people are shown.
 */
export const roleLabel: Record<Role, string> = {
  admin: "Admin",
  operatore: "Operatore",
};
