import type { Id } from "@/convex/_generated/dataModel";

/** A Campagna as the header at the counter and the Admin screen read her. */
export type Campagna = {
  _id: Id<"campagne">;
  name: string;
  openedAt: number;
  closedAt: number | null;
};

/** The Campagna the mill has open, of the ones it has had, or nobody. */
export const openOf = (campagne: Campagna[]): Campagna | null =>
  campagne.find((campagna) => campagna.closedAt === null) ?? null;

/** A date as the mill says one: «3 settembre 2026». */
export const dateOf = (at: number) =>
  new Date(at).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/**
 * Where the device remembers the Campagna its Operatore named.
 *
 * The choice belongs to the device and not to the account: the mill has no
 * Campagna open, and whoever is standing at this counter has said once which
 * season what they register belongs to (#19). It is forgotten the moment an
 * Admin opens a Campagna, because the open one is then the answer.
 */
const DEVICE_KEY = "pendolino.campagna";

/**
 * The screens reading that choice, so that the header and the flow beneath it
 * change together the instant somebody taps another Campagna.
 */
const listeners = new Set<() => void>();

/** The Campagna this device names, as it was written down. */
export const namedCampagna = (): string | null =>
  typeof window === "undefined"
    ? null
    : window.localStorage.getItem(DEVICE_KEY);

/** The same, on a server render, where a device has no memory to read. */
export const noNamedCampagna = (): string | null => null;

/** The Operatore names a Campagna, or takes back the choice. */
export const nameCampagna = (campagnaId: Id<"campagne"> | null) => {
  if (campagnaId === null) {
    window.localStorage.removeItem(DEVICE_KEY);
  } else {
    window.localStorage.setItem(DEVICE_KEY, campagnaId);
  }
  for (const listener of listeners) {
    listener();
  }
};

export const subscribeToNamedCampagna = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
