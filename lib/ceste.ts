import type { Id } from "@/convex/_generated/dataModel";
import type { Forma, State } from "@/convex/schema";
import type { Cliente } from "@/lib/cliente";

/** How many Ceste, as the counter says it. */
export const cesteCount = (count: number) =>
  count === 1 ? "1 Cesta" : `${count} Ceste`;

/**
 * Where a Cesta is, in the mill's own words: on the fleet screen, and in the
 * sentence that says a Cesta about to be emptied was not where the app had her
 * (#18).
 */
export const stateLabel: Record<State, string> = {
  disponibile: "Disponibile",
  fuori: "Fuori",
  attesa_molitura: "Attesa molitura",
  dismessa: "Dismessa",
};

/** How each state reads on a badge: the mill's colours for the mill's words. */
export const stateClass: Record<State, string> = {
  disponibile: "bg-secondary text-secondary-foreground",
  fuori: "bg-primary text-primary-foreground",
  attesa_molitura: "bg-muted text-muted-foreground",
  dismessa: "bg-destructive/10 text-destructive",
};

/** The Forma as a screen writes it out, where the Codice writes it Q or R. */
export const formaLabel: Record<Forma, string> = {
  quadrata: "Quadrata",
  rettangolare: "Rettangolare",
};

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
  state: State;
  cliente: Cliente | null;
};

/**
 * The Codice as the Etichetta prints it and as a tile reads it: the Portata and
 * the Forma small, the numero large. One string on the label, two lines under
 * a thumb.
 */
export const codiceParts = (codice: string) => {
  const lastDash = codice.lastIndexOf("-");
  return {
    prefix: codice.slice(0, lastDash),
    numero: codice.slice(lastDash + 1),
  };
};

/**
 * A day at the mill, as the counter says it out loud: "25 ott". The year is
 * left off because a Campagna does not span one.
 */
export const dayOf = (at: number) =>
  new Date(at).toLocaleDateString("it-IT", { day: "numeric", month: "short" });

/** How many days ago something happened, as the counter counts them. */
export const daysSince = (at: number) => {
  const days = Math.floor((Date.now() - at) / 86_400_000);
  return days === 1 ? "1 giorno" : `${days} giorni`;
};
