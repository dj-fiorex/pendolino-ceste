import type { Id } from "@/convex/_generated/dataModel";

/** A Cliente as the screens carry them around. */
export type Cliente = {
  _id: Id<"clienti">;
  name: string;
  alias: string[];
  phone: string | null;
};

/**
 * A Cliente as the counter says them: the name, then the Soprannomi. Every
 * screen that lists Clienti reads them this way, because the Soprannome is
 * what tells two Giuseppe Amato apart (CONTEXT.md).
 */
export const clienteLabel = (cliente: { name: string; alias: string[] }) =>
  [cliente.name, ...cliente.alias].join(" · ");

/** The Soprannomi as they are typed: one line, separated by commas. */
export const readAlias = (typed: string) =>
  typed
    .split(",")
    .map((one) => one.trim())
    .filter((one) => one !== "");
