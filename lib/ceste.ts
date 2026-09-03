import type { Id } from "@/convex/_generated/dataModel";
import type { Cliente } from "@/lib/cliente";

/** How many Ceste, as the counter says it. */
export const cesteCount = (count: number) =>
  count === 1 ? "1 Cesta" : `${count} Ceste`;

/**
 * A Cesta as a typed numero finds her: what is printed on her Etichetta, and
 * whom the app believes she is with. Everything at the counter works from this
 * — the running list of a Ritiro or of a Rientro is a list of these.
 */
export type FoundCesta = {
  _id: Id<"ceste">;
  numero: number;
  codice: string;
  portata: number;
  cliente: Cliente | null;
};
