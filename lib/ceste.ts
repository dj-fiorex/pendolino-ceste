import type { Id } from "@/convex/_generated/dataModel";
import type { Forma, State } from "@/convex/schema";
import { clienteInSentence, type Cliente } from "@/lib/cliente";

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
 * Where a Cesta is, as a sentence puts it: "Disponibile", "in Attesa
 * molitura", "Fuori con Giuseppe Amato (Turi)". What the Registro reads and
 * what the Rettifica form says confirming will do (#28).
 *
 * A Cesta *is* Fuori, Disponibile or Dismessa, and she is *in* Attesa
 * molitura: a line read at a glance has to read like Italian. The Cliente is
 * handed in already named, because a sentence names them one way and a list
 * another, and only Fuori is somebody's hands.
 */
export const stateInSentence = (state: State, cliente: string | null) => {
  if (state === "attesa_molitura") {
    return "in Attesa molitura";
  }
  return state === "fuori" && cliente !== null
    ? `Fuori con ${cliente}`
    : stateLabel[state];
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
 * Where the app has a Cesta, as the sentence after "risulta" says it: "Fuori
 * con Giuseppe Amato", "in Attesa molitura", "Dismessa". What every warning at
 * the counter names before it says the movement goes through anyway (#21).
 *
 * A Cesta *is* Fuori, Disponibile or Dismessa, and she is *in* Attesa
 * molitura: a warning an Operatore reads at a glance on a busy morning has to
 * read like Italian. The Cliente comes with her wherever the app has one,
 * because whose the app thought she was is the whole of what is off — named as
 * a sentence names them, "Giuseppe Amato (Turi)", because a warning about
 * several Ceste sets them apart with the same middot a list of Soprannomi uses.
 */
export const whereTheAppHasHer = (cesta: FoundCesta) => {
  if (cesta.state === "attesa_molitura") {
    return "in Attesa molitura";
  }
  return cesta.cliente === null
    ? stateLabel[cesta.state]
    : `${stateLabel[cesta.state]} con ${clienteInSentence(cesta.cliente)}`;
};

/**
 * One Cesta as a warning at the counter names her: her Codice, then where the
 * app has her. The Ritiro and the Rientro both read this, so that a Cesta not
 * where the app had her is said the same way whichever screen says it (#21).
 *
 * A Cesta an Admin has written off says the movement leaves her written off.
 * She goes out on the trailer or comes back on it like any other, but nothing
 * at the counter puts her back among the Ceste the mill counts: that is an
 * Admin's Rettifica of *ritrovata* and nobody else's (#20).
 */
export const warningLine = (cesta: FoundCesta) =>
  cesta.state === "dismessa"
    ? `${cesta.codice} risulta Dismessa e tale resta`
    : `${cesta.codice} risulta ${whereTheAppHasHer(cesta)}`;

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
