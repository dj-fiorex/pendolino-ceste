import type { Id } from "@/convex/_generated/dataModel";

/**
 * As much of a Cliente as it takes to name them: the name, and the Soprannomi
 * that tell two Giuseppe Amato apart. Everything that writes a Cliente's name
 * out asks for this and no more.
 */
export type ClienteName = { name: string; alias: string[] };

/** A Cliente as the screens carry them around. */
export type Cliente = ClienteName & {
  _id: Id<"clienti">;
  phone: string | null;
  /** Whether they have asked not to be written to (CONTEXT.md, Sms). */
  smsOptOut: boolean;
};

/**
 * A Cliente as the counter says them: the name, then the Soprannomi. Every
 * screen that lists Clienti reads them this way, because the Soprannome is
 * what tells two Giuseppe Amato apart (CONTEXT.md).
 */
export const clienteLabel = (cliente: ClienteName) =>
  [cliente.name, ...cliente.alias].join(" · ");

/** The Soprannomi as they are typed: one line, separated by commas. */
export const readAlias = (typed: string) =>
  typed
    .split(",")
    .map((one) => one.trim())
    .filter((one) => one !== "");

/**
 * A Cliente as a sentence names them: the name, then the Soprannomi in
 * brackets. The Registro reads as prose rather than as a list, and "Giuseppe
 * Amato (Turi)" is how the counter would say it out loud.
 */
export const clienteInSentence = (cliente: ClienteName) =>
  cliente.alias.length === 0
    ? cliente.name
    : `${cliente.name} (${cliente.alias.join(", ")})`;
