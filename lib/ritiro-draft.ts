import type { MediaKind, State } from "@/convex/schema";
import { stateLabel, type FoundCesta } from "@/lib/ceste";
import type { Cliente } from "@/lib/cliente";
import { mediaLabel } from "@/lib/media";

/**
 * A Ritiro somebody started at this counter and has not confirmed: whose it
 * is, the Ceste already added to it, and which of the signature and the
 * photograph were taken and are not in here.
 *
 * An Operatore who has scanned five of six Ceste must not lose them because
 * the phone locked, the tab was closed or the app reloaded — losing half a
 * Ritiro on a busy morning is what makes people stop using an app on day two
 * (#24). What is written down is what it takes to put that half-Ritiro back on
 * screen: the Cliente it is for, and each Cesta as the counter read her.
 *
 * The signature and the photograph themselves are deliberately not written
 * down; `writeDraft` says why, and `notKept` is what stands in for them.
 */
export type RitiroDraft = {
  cliente: Cliente;
  ceste: FoundCesta[];
  /**
   * Everything taken on this Ritiro at any point, all of which will have to be
   * taken again, because none of it is in here. Named rather than quietly
   * missing, so that the offer can say so out loud: somebody who had the
   * Cliente sign and then dropped the phone must not confirm the Ritiro
   * believing his signature is still on it.
   */
  notKept: MediaKind[];
};

/**
 * Where the device writes the Ritiro it is in the middle of.
 *
 * One key, so one draft per device (#24): a Ritiro started while another is
 * written down writes over it, and the Operatore is offered back whichever is
 * there. The draft belongs to the device and not to the account, as the named
 * Campagna does — what the phone on this counter is holding is a fact about
 * the phone, and it is precisely a phone passed between two Operatori that the
 * offer exists to protect.
 */
const DEVICE_KEY = "pendolino.ritiro";

// Asked of the record that names each of them, and asked with `hasOwn` rather
// than with `in`: `in` answers for everything every object inherits, so a draft
// carrying a state of "constructor" would pass and then be written into a
// warning as `undefined` — which is the one thing the checks below exist to
// stop.
const isState = (read: unknown): read is State =>
  typeof read === "string" && Object.hasOwn(stateLabel, read);

const isMediaKind = (read: unknown): read is MediaKind =>
  typeof read === "string" && Object.hasOwn(mediaLabel, read);

const isCliente = (read: unknown): read is Cliente => {
  const cliente = read as Cliente | null;
  return (
    typeof cliente === "object" &&
    cliente !== null &&
    typeof cliente._id === "string" &&
    typeof cliente.name === "string" &&
    Array.isArray(cliente.alias) &&
    cliente.alias.every((one) => typeof one === "string") &&
    (cliente.phone === null || typeof cliente.phone === "string")
  );
};

const isCesta = (read: unknown): read is FoundCesta => {
  const cesta = read as FoundCesta | null;
  return (
    typeof cesta === "object" &&
    cesta !== null &&
    typeof cesta._id === "string" &&
    typeof cesta.numero === "number" &&
    typeof cesta.codice === "string" &&
    typeof cesta.portata === "number" &&
    isState(cesta.state) &&
    (cesta.cliente === null || isCliente(cesta.cliente))
  );
};

/**
 * Whether what the device handed back is a Ritiro this screen can put on.
 *
 * Checked field by field rather than trusted, because the phone at the counter
 * keeps its draft across a deploy: a draft written by last week's app and read
 * by this week's has whatever shape it had then. A draft that no longer fits
 * is dropped and the Operatore starts clean, which costs them the scans of one
 * Ritiro; a draft taken on trust would put `undefined` into a sentence and
 * take the Ritiro screen down for every Cliente after it.
 */
const isDraft = (read: unknown): read is RitiroDraft => {
  const draft = read as RitiroDraft | null;
  return (
    typeof draft === "object" &&
    draft !== null &&
    isCliente(draft.cliente) &&
    Array.isArray(draft.ceste) &&
    draft.ceste.length > 0 &&
    draft.ceste.every(isCesta) &&
    Array.isArray(draft.notKept) &&
    draft.notKept.every(isMediaKind)
  );
};

/**
 * The Ritiro this device was left in the middle of, or nothing.
 *
 * Nothing is also the answer where the device will not be read at all — a
 * server render, a browser with storage shut off. The draft is a safety net
 * under the counter and never a thing the counter needs: an Operatore whose
 * phone keeps no draft records Ritiri exactly as they did before (ADR-0005).
 */
export const readDraft = (): RitiroDraft | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const written = window.localStorage.getItem(DEVICE_KEY);
    if (written === null) {
      return null;
    }
    const read: unknown = JSON.parse(written);
    return isDraft(read) ? read : null;
  } catch {
    return null;
  }
};

/**
 * Writes the Ritiro being built down on this device, over whatever was there.
 *
 * The signature and the photograph are named in the draft and not carried by
 * it. Two reasons, and the second is the one that decides it.
 *
 * `localStorage` holds strings, so a photograph would have to go in as base64
 * against the few megabytes a whole origin gets — and storage filling up would
 * lose exactly the Ritiro this exists to protect. IndexedDB would hold the
 * blob itself, but a second store, opened and migrated, for the one thing that
 * must not outlive the moment is the wrong shape for the job.
 *
 * And a signature is one man's hand and no other's. Changing Cliente already
 * takes it off for that reason (#25), and a draft is the same hazard stretched
 * over a reload: a phone shared across a shift must never confirm one
 * Cliente's signature under the next Cliente's name. Both are optional and
 * skipped on most Ritiri by the mill's own decision (spec #1, story 19), so
 * losing them costs a tap, where losing the Ceste costs the morning.
 *
 * A device that refuses to keep the draft — storage full, storage off — is not
 * told about and does not stop anything: the Ritiro on screen goes through
 * either way, and all that is lost is the net under it.
 */
export const writeDraft = (draft: RitiroDraft) => {
  try {
    window.localStorage.setItem(DEVICE_KEY, JSON.stringify(draft));
  } catch {
    // Nothing to do and nothing to say: see above.
  }
};

/**
 * Forgets the Ritiro this device was holding.
 *
 * Called when it has been confirmed and is now the mill's record rather than a
 * device's note, and when the Operatore has been offered it back and said no
 * (#24). Both clear it for good: the draft is a Ritiro nobody has decided
 * about yet, and after either of those somebody has.
 */
export const forgetDraft = () => {
  try {
    window.localStorage.removeItem(DEVICE_KEY);
  } catch {
    // As above: a device that will not forget it will be written over.
  }
};
