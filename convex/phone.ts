/**
 * What the mill's telephone numbers are, as one rule the form and the mutation
 * both read (ADR-0009).
 *
 * Here rather than in `lib/` because the mutation is the voice that refuses
 * and the form is only the one that warns first: the rule belongs on the side
 * that cannot be talked past. Nothing in this file touches the database, so a
 * screen may import it as freely as a mutation does.
 *
 * The rule is the mill's own rather than a library's. Italian numbering is
 * small — a mobile begins with 3, a landline with 0 — and the edge cases a
 * library would get right are ones a frantoio in Puglia will not see, while
 * its bulk would ride to the counter on a phone with one bar of signal.
 */

/** Everything that is not a digit or a leading plus, which is decoration. */
const digitsOf = (typed: string) => typed.replace(/[^\d]/g, "");

/**
 * What a number turns out to be. A landline is a perfectly good telephone that
 * happens not to receive an Sms — a fact about the number, not a mistake by
 * whoever typed it — so it reads as itself rather than as a refusal.
 */
export type PhoneReading =
  | { kind: "empty" }
  | { kind: "mobile"; e164: string }
  | { kind: "landline"; e164: string }
  | { kind: "estero"; e164: string }
  | { kind: "unreadable" };

export type PhoneKind = PhoneReading["kind"];

/**
 * A telephone as the counter typed it, read into what it is and into the one
 * form a carrier will take.
 *
 * An empty field is not an error: a Cliente the mill has no number for is an
 * ordinary Cliente, and leaving it blank is what keeps the counter unblocked
 * while a queue waits (ADR-0009, ADR-0005).
 */
export const readPhone = (typed: string): PhoneReading => {
  const trimmed = typed.trim();
  if (trimmed === "") {
    return { kind: "empty" };
  }

  const digits = digitsOf(trimmed);
  // A number written for abroad, which the mill has a few of: whoever winters
  // in Germany still brings olives in October. Taken as given past the country
  // code, because this file knows Italy and does not pretend to know the rest.
  const international = trimmed.startsWith("+") || digits.startsWith("00");
  const bare = digits.replace(/^00/, "");
  if (international && !bare.startsWith("39")) {
    return bare.length >= 8 && bare.length <= 15
      ? { kind: "estero", e164: `+${bare}` }
      : { kind: "unreadable" };
  }

  // Italy, however it was written: with the country code, with the double
  // zero, or as the nine or ten digits somebody reads off a scrap of paper.
  //
  // A bare 39 at the front is left where it is rather than read as the country
  // code, because 391, 392 and 393 are mobile prefixes: stripping it would
  // turn a real number into a short one and refuse it.
  const national = international ? bare.slice(2) : digits;
  if (/^3\d{8,9}$/.test(national)) {
    return { kind: "mobile", e164: `+39${national}` };
  }
  if (/^0\d{5,10}$/.test(national)) {
    return { kind: "landline", e164: `+39${national}` };
  }
  return { kind: "unreadable" };
};

/** Whether a number is one an Sms can reach at all. */
export const isSendable = (reading: PhoneReading): boolean =>
  reading.kind === "mobile" || reading.kind === "estero";

/**
 * The number as it is stored: E.164, which is the only shape a carrier takes,
 * and nothing at all where the Cliente gave none.
 */
export const storedPhone = (typed: string): string | null => {
  const reading = readPhone(typed);
  return reading.kind === "empty" || reading.kind === "unreadable"
    ? null
    : reading.e164;
};

/**
 * The same number as the counter reads it back off the screen. Italy without
 * its country code, spaced the way a mobile is said out loud; anywhere else as
 * it is dialled, since a foreign number spaced by guesswork is a foreign
 * number made harder to read.
 */
export const phoneInNational = (e164: string): string => {
  if (!e164.startsWith("+39")) {
    return e164;
  }
  const national = e164.slice(3);
  if (!national.startsWith("3")) {
    return national;
  }
  const head = national.slice(0, 3);
  const rest = national.slice(3);
  return rest.length === 7
    ? `${head} ${rest.slice(0, 3)} ${rest.slice(3)}`
    : `${head} ${rest}`;
};
