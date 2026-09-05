/**
 * What an Sms says before it says it about anybody: the words an Admin
 * settles, the places a Cliente's own name and Ceste are written into, and
 * what all of it costs to send.
 *
 * Here beside `phone.ts` and for the same reason: the mutation refuses a
 * template it cannot render and the editor says so first, which is one rule in
 * two voices. Nothing here touches the database.
 */

/**
 * What a template may write a Cliente's own facts into. Six, and no seventh:
 * a placeholder this list does not carry is refused when the template is
 * saved, because an Admin editing words at a desk is not the counter and
 * refusing them there costs nothing (ADR-0005).
 *
 * There is no surname among them. The registry keeps one name, as the counter
 * writes it, and namesakes are told apart by a Soprannome rather than by a
 * second field (CONTEXT.md).
 */
export const SMS_PLACEHOLDERS = {
  nome: "Il nome del Cliente, come sta in anagrafica",
  ceste: "Le Ceste di questo movimento: «1 cesta», «6 ceste»",
  totale: "Quelle che gli restano Fuori dopo: «nessuna cesta»",
  numeri: "I numeri delle Ceste: «17, 22, 34»",
  frantoio: "Il nome del frantoio",
  telefono: "Il telefono del frantoio",
} as const;

export type Placeholder = keyof typeof SMS_PLACEHOLDERS;

export const PLACEHOLDERS = Object.keys(SMS_PLACEHOLDERS) as Placeholder[];

/** What each placeholder stands for, for one Cliente on one occasion. */
export type SmsValues = Record<Placeholder, string>;

/** Every `{{…}}` a template carries, in the order they were written. */
const placeholdersIn = (template: string): string[] =>
  [...template.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)].map(([, name]) => name);

/**
 * The placeholders a template asks for that do not exist — a `{{cognome}}`
 * left over from somebody's first draft, or a `{{nomee}}` nobody read back.
 *
 * Named rather than counted, because the refusal has to say which one: a
 * template saved with a typo goes out to two hundred people reading «Gentile
 * {{nomee}}», and no later screen can take that back (ADR-0004).
 */
export const unknownPlaceholders = (template: string): string[] => [
  ...new Set(
    placeholdersIn(template).filter(
      (name) => !PLACEHOLDERS.includes(name as Placeholder),
    ),
  ),
];

/** The words as they go out, with this Cliente's own facts written in. */
export const renderTemplate = (template: string, values: SmsValues): string =>
  template.replace(/\{\{\s*([^}]*?)\s*\}\}/g, (whole, name: string) =>
    PLACEHOLDERS.includes(name as Placeholder)
      ? values[name as Placeholder]
      : whole,
  );

/**
 * Ceste as a message says them, noun and all: "6 ceste", "1 cesta", and
 * "nessuna cesta" where there are none left to bring back.
 *
 * The noun travels with the number so that a template reads "hai ritirato
 * {{ceste}}" and comes out right at one, at six and at none — the three ways
 * an Admin writing the sentence would otherwise get it wrong. Lower case,
 * unlike everywhere else in the app: this is the mill talking to a farmer, not
 * the app naming a Cesta.
 */
export const cesteInWords = (count: number): string =>
  count === 0 ? "nessuna cesta" : count === 1 ? "1 cesta" : `${count} ceste`;

/**
 * The typographic apostrophe, straightened on its way out. Nobody types it on
 * purpose — it arrives from a phone keyboard or a paste out of a document —
 * and it is the one character that quietly halves what fits in a message.
 */
export const tidyForSms = (text: string): string =>
  text.replace(/[‘’‛]/g, "'").replace(/[“”]/g, '"');

/**
 * The GSM-7 alphabet: what a carrier can carry at 160 characters to the
 * message. Italian lives here comfortably — è, à, ò, ù and ì are all in it —
 * which is why an ordinary Italian sentence costs one message and not two.
 */
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";

/** The seven that fit, but cost two characters apiece. */
const GSM_EXTENDED = "^{}\\[~]|€";

/**
 * The characters a message carries that GSM-7 does not — an emoji, a curly
 * quote that escaped straightening, a Greek letter. One of them anywhere drops
 * the whole message to 70 characters a segment.
 */
export const outsideGsm = (text: string): string[] => [
  ...new Set(
    [...text].filter(
      (character) =>
        !GSM_BASIC.includes(character) && !GSM_EXTENDED.includes(character),
    ),
  ),
];

/**
 * What a message costs to send: how long it is, how many messages the carrier
 * will actually bill, and whether one character has pushed the rest into the
 * expensive alphabet.
 *
 * Counted rather than capped. A mill that wants a three-message text may have
 * one; what it may not have is an editor that lets it happen quietly.
 */
export const segmentsOf = (
  text: string,
): { characters: number; segments: number; unicode: boolean } => {
  const unicode = outsideGsm(text).length > 0;
  if (unicode) {
    // UCS-2 counts the units a surrogate pair takes, not the emoji a person
    // sees, because that is what the carrier counts.
    const characters = text.length;
    return {
      characters,
      segments:
        characters <= 70
          ? Math.max(1, Math.ceil(characters / 70))
          : Math.ceil(characters / 67),
      unicode,
    };
  }
  const characters = [...text].reduce(
    (total, character) => total + (GSM_EXTENDED.includes(character) ? 2 : 1),
    0,
  );
  return {
    characters,
    segments:
      characters <= 160
        ? Math.max(1, Math.ceil(characters / 160))
        : Math.ceil(characters / 153),
    unicode,
  };
};

/**
 * What the two automatic messages say until an Admin says otherwise. Most
 * mills never change a default, so these are written to be the message rather
 * than a placeholder for one.
 *
 * The Rientro one says "Da riportare:" rather than "ti restano", so that the
 * happy case — a farmer who has just brought back the last of them — reads
 * "Da riportare: nessuna cesta." and not something ungrammatical.
 *
 * Both carry the mill's telephone, because nobody can reply to an Sms the mill
 * sends: a message with a question in it and no way back is a message that
 * sends somebody to the counter for nothing.
 */
export const DEFAULT_SMS_RITIRO =
  "Gentile {{nome}}, hai ritirato {{ceste}} dal {{frantoio}}. In tutto hai {{totale}} da riportare. Info: {{telefono}}";

export const DEFAULT_SMS_RIENTRO =
  "Gentile {{nome}}, abbiamo ricevuto {{ceste}}. Da riportare: {{totale}}. Info: {{telefono}}";
