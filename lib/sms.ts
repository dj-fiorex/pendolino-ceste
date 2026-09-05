import type { SmsDelivery, SmsKind, SmsUnsendable } from "@/convex/schema";

/** Which Sms this is, as a screen names it. */
export const smsKindLabel: Record<SmsKind, string> = {
  ritiro: "Ritiro",
  rientro: "Rientro",
  manuale: "Scritto a mano",
};

/**
 * Why a message the mill meant to send never left. Said as a fact about the
 * number rather than as an error: a Cliente with a landline gave the mill a
 * perfectly good telephone, and the app is only saying it cannot text it.
 */
const unsendableLabel: Record<SmsUnsendable, string> = {
  no_phone: "non abbiamo il telefono",
  landline: "è un numero fisso",
  unreadable: "il numero non si può leggere",
};

/**
 * What became of one Sms, in a few words. The three that matter to the mill
 * are told apart on purpose: *Inviato* is Twilio taking the message, and
 * *Consegnato* is the telephone in somebody's pocket having it.
 */
export const smsDeliveryLabel = (delivery: SmsDelivery): string => {
  switch (delivery.kind) {
    case "queued":
      return "In partenza";
    case "sent":
      return "Inviato";
    case "delivered":
      return "Consegnato";
    case "withheld":
      return "Non inviato: prova";
    case "failed":
      return "Non riuscito";
    case "unsendable":
      return `Non inviato: ${unsendableLabel[delivery.reason]}`;
  }
};

/**
 * Whether a message is one the mill should look at twice. The colour a screen
 * gives a row, and nothing else: an Sms that did not arrive changes nothing
 * about the Ritiro that sent it (ADR-0005).
 */
export const smsWentWrong = (delivery: SmsDelivery): boolean =>
  delivery.kind === "failed" || delivery.kind === "unsendable";

/** How the mill reads a clock: the day and the hour, in Italy. */
export const smsWhen = (at: number) =>
  new Date(at).toLocaleString("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  });
