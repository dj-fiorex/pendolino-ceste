import type { Id } from "@/convex/_generated/dataModel";
import type {
  Action,
  ClienteField,
  EtichettaSettingField,
  EtichettaSize,
  Forma,
  PlainMovimentoKind,
} from "@/convex/schema";
import { cesteCount, dayOf, stateInSentence } from "@/lib/ceste";
import { clienteInSentence, type ClienteName } from "@/lib/cliente";
import { ETICHETTA_SIZE_LABELS } from "@/lib/etichetta";
import { movimentoInSentence, rettificaCauseLabel } from "@/lib/movimento";
import { roleLabel } from "@/lib/operatore";

/** A Registro row as the screen receives it. */
export type RegistroRow = {
  _id: Id<"registro">;
  at: number;
  operatore: string;
  cliente: ClienteName | null;
  /** The Campagna it belongs to, and nobody on the rows that predate them. */
  campagna: string | null;
  /** Whether the action left a Rettifica behind it (#21). */
  producedRettifica: boolean;
  /** The action this row corrects, where this row is a correction (#28). */
  corrects: {
    _id: Id<"registro">;
    at: number;
    kind: PlainMovimentoKind;
  } | null;
  /** The Rettifiche that corrected this row afterwards, where any did. */
  correctedBy: { _id: Id<"registro">; at: number; numero: number }[];
  action: Action;
};

/**
 * The actions that are about a Campagna herself, and so name her in their own
 * sentence: saying the Campagna after them again would read as a stammer.
 */
const ABOUT_A_CAMPAGNA: Action["kind"][] = [
  "campagna_aperta",
  "campagna_rinominata",
  "campagna_chiusa",
  "campagna_riaperta",
];

/** Whether a row still has to say which Campagna it belongs to. */
export const saysItsCampagna = (row: RegistroRow) =>
  row.campagna !== null && !ABOUT_A_CAMPAGNA.includes(row.action.kind);

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
 * The other half of a correction, said after the action itself: what a
 * Rettifica of *errore* puts right, and what put this row right afterwards.
 *
 * The pair reads from whichever end the Admin happens to be looking at, which
 * is the point of writing the wrong Movimento down and leaving it there: the
 * Registro shows the mistake and the correction, never one without the other
 * (ADR-0004, #28).
 */
const asOneOfAPair = ({ corrects, correctedBy }: RegistroRow) => {
  const puts =
    corrects === null
      ? ""
      : ` Corregge ${movimentoInSentence[corrects.kind]} del ${dayOf(corrects.at)}.`;
  if (correctedBy.length === 0) {
    return puts;
  }
  const numeri = correctedBy.map((one) => one.numero).join(", ");
  const [first] = correctedBy;
  return correctedBy.length === 1
    ? `${puts} Corretto il ${dayOf(first.at)} da una Rettifica sulla Cesta ${numeri}.`
    : `${puts} Corretto da ${correctedBy.length} Rettifiche, sulle Ceste ${numeri}.`;
};

/**
 * One Registro row as an Italian sentence: who did what, to whom, and to which
 * Ceste. Rendered here on the device rather than stored, so that the row keeps
 * the structured fields the filters read and the mill keeps a line it can read
 * out loud.
 */
export const registroSentence = (row: RegistroRow): string =>
  `${whatWasDone(row)}${asOneOfAPair(row)}`;

/** The action itself, before anything is said about correcting it. */
const whatWasDone = ({ operatore, cliente, action }: RegistroRow): string => {
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
    case "rientro":
      return `${operatore} ha registrato un Rientro di ${cesteCount(action.numeri.length)} da ${whom(cliente)}: ${numeriInSentence(action.numeri)}.`;
    case "svuotamento":
      return `${operatore} ha svuotato ${cesteCount(action.numeri.length)}: ${numeriInSentence(action.numeri)}.`;
    case "rettifica": {
      // Where the Rettifica left her, and, where that is a Cliente's hands,
      // whose: the row already names him, and the sentence says why he is on
      // it.
      const becomes = stateInSentence(action.becomes, whom(cliente));
      const note = action.note === undefined ? "" : ` Nota: «${action.note}»`;
      return `${operatore} ha registrato una Rettifica sulla Cesta ${action.numero}: ${rettificaCauseLabel[action.cause].toLowerCase()}. Adesso è ${becomes}.${note}`;
    }
    case "cliente_disattivato":
      return action.numeriFuori.length === 0
        ? `${operatore} ha disattivato il Cliente ${action.name}.`
        : `${operatore} ha disattivato il Cliente ${action.name}, che aveva ancora ${cesteCount(action.numeriFuori.length)} Fuori: ${numeriInSentence(action.numeriFuori)}.`;
    case "campagna_aperta":
      return `${operatore} ha aperto la Campagna ${action.name}.`;
    case "campagna_rinominata":
      return `${operatore} ha rinominato la Campagna da ${quoted(action.before)} a ${quoted(action.after)}.`;
    case "campagna_chiusa":
      return action.numeriFuori.length === 0
        ? `${operatore} ha chiuso la Campagna ${action.name}.`
        : `${operatore} ha chiuso la Campagna ${action.name}, con ancora ${cesteCount(action.numeriFuori.length)} Fuori: ${numeriInSentence(action.numeriFuori)}.`;
    case "campagna_riaperta":
      return `${operatore} ha riaperto la Campagna ${action.name}.`;
    case "etichette_settings":
      return `${operatore} ha cambiato le Etichette: ${changesInSentence(action.changes, etichettaFieldLabel, etichettaValue)}.`;
    case "operatore_invitato":
      return `${operatore} ha invitato ${action.name} (${action.email}) come ${roleLabel[action.role]}.`;
    case "invito_accettato":
      return `${operatore} ha accettato l'invito come ${roleLabel[action.role]}.`;
    case "operatore_reset_inviato":
      return `${operatore} ha mandato a ${action.name} (${action.email}) un link per rifare la password.`;
    case "operatore_promosso":
      return `${operatore} ha promosso ${action.name} da ${roleLabel[action.before]} a ${roleLabel[action.after]}.`;
    case "operatore_disattivato":
      return `${operatore} ha disattivato l'account di ${action.name}.`;
  }
};
