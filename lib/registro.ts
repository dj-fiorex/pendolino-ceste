import type { Id } from "@/convex/_generated/dataModel";
import type {
  Action,
  ClienteField,
  EtichettaSettingField,
  EtichettaSize,
  Forma,
} from "@/convex/schema";
import { cesteCount } from "@/lib/ceste";
import { clienteInSentence, type ClienteName } from "@/lib/cliente";
import { ETICHETTA_SIZE_LABELS } from "@/lib/etichetta";

/** A Registro row as the screen receives it. */
export type RegistroRow = {
  _id: Id<"registro">;
  at: number;
  operatore: string;
  cliente: ClienteName | null;
  action: Action;
};

/** The hour a row was written, as the mill reads a clock. */
export const timeOf = (at: number) =>
  new Date(at).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });

const formaInSentence: Record<Forma, { one: string; many: string }> = {
  quadrata: { one: "quadrata", many: "quadrate" },
  rettangolare: { one: "rettangolare", many: "rettangolari" },
};

const clienteFieldLabel: Record<ClienteField, string> = {
  name: "il nome",
  alias: "i soprannomi",
  phone: "il telefono",
};

const etichettaFieldLabel: Record<EtichettaSettingField, string> = {
  etichettaSize: "la misura",
  millName: "il nome del frantoio",
  millNameOnEtichetta: "il nome sull'Etichetta",
  millPhone: "il telefono del frantoio",
  millPhoneOnEtichetta: "il telefono sull'Etichetta",
};

/** What a field said before a correction, and what it says now. */
type ChangeValue = string | boolean | string[] | null;

type Change<Field extends string> = {
  field: Field;
  before: ChangeValue;
  after: ChangeValue;
};

/**
 * A value as the sentence quotes it. A field that said nothing says so in
 * words: an empty telephone is "nessuno", not an empty pair of quotes nobody
 * can see.
 */
const quoted = (value: ChangeValue): string => {
  if (value === null) {
    return "nessuno";
  }
  if (typeof value === "boolean") {
    return value ? "sì" : "no";
  }
  if (Array.isArray(value)) {
    return value.length === 0 ? "nessuno" : `«${value.join(", ")}»`;
  }
  return value === "" ? "nessuno" : `«${value}»`;
};

const isEtichettaSize = (value: string): value is EtichettaSize =>
  value in ETICHETTA_SIZE_LABELS;

/** An Etichetta setting as the screen that sets it shows it. */
const etichettaValue = (value: ChangeValue) =>
  typeof value === "string" && isEtichettaSize(value)
    ? quoted(ETICHETTA_SIZE_LABELS[value])
    : quoted(value);

/** What each changed field used to say, and says now, one clause apiece. */
const changesInSentence = <Field extends string>(
  changes: Change<Field>[],
  label: Record<Field, string>,
  say: (value: ChangeValue) => string,
) =>
  changes
    .map(
      (change) =>
        `${label[change.field]} da ${say(change.before)} a ${say(change.after)}`,
    )
    .join("; ");

/**
 * The Cliente a row concerns. Every kind of action that reaches this carries
 * one; the fallback is here because the row's type cannot say which kinds do.
 */
const whom = (cliente: RegistroRow["cliente"]) =>
  cliente === null ? "un Cliente" : clienteInSentence(cliente);

/** The Ceste a row moved, by numero, as the Operatore would read them out. */
const numeriInSentence = (numeri: number[]) => numeri.join(", ");

/**
 * One Registro row as an Italian sentence: who did what, to whom, and to which
 * Ceste. Rendered here on the device rather than stored, so that the row keeps
 * the structured fields the filters read and the mill keeps a line it can read
 * out loud.
 */
export const registroSentence = ({
  operatore,
  cliente,
  action,
}: RegistroRow): string => {
  switch (action.kind) {
    case "censimento": {
      const forma = formaInSentence[action.forma];
      const which =
        action.count === 1
          ? `la numero ${action.fromNumero}`
          : `dalla ${action.fromNumero} alla ${action.toNumero}`;
      return `${operatore} ha fatto il Censimento di ${cesteCount(action.count)} da ${action.portata} kg ${action.count === 1 ? forma.one : forma.many}: ${which}.`;
    }
    case "cliente_creato":
      return `${operatore} ha aggiunto il Cliente ${action.name}.`;
    case "cliente_modificato":
      return `${operatore} ha corretto ${whom(cliente)}: ${changesInSentence(action.changes, clienteFieldLabel, quoted)}.`;
    case "ritiro":
      return `${operatore} ha registrato un Ritiro di ${cesteCount(action.numeri.length)} a ${whom(cliente)}: ${numeriInSentence(action.numeri)}.`;
    case "cliente_disattivato":
      return action.numeriFuori.length === 0
        ? `${operatore} ha disattivato il Cliente ${action.name}.`
        : `${operatore} ha disattivato il Cliente ${action.name}, che aveva ancora ${cesteCount(action.numeriFuori.length)} Fuori: ${numeriInSentence(action.numeriFuori)}.`;
    case "etichette_settings":
      return `${operatore} ha cambiato le Etichette: ${changesInSentence(action.changes, etichettaFieldLabel, etichettaValue)}.`;
  }
};
