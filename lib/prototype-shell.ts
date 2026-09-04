/**
 * PROTOTYPE (#shell). Throwaway: the variant switch behind the three app
 * shells, kept on the device so that walking from the home to a Ritiro stays
 * inside the same variant. Nothing here is meant to be merged.
 */

export const shellVariants = ["A", "B", "C"] as const;

export type ShellVariant = (typeof shellVariants)[number];

/** What each variant is called on the switcher pill. */
export const shellName: Record<ShellVariant, string> = {
  A: "Banco",
  B: "Azioni",
  C: "Stato",
};

const KEY = "prototype-shell";

const listeners = new Set<() => void>();

const isVariant = (value: string | null): value is ShellVariant =>
  value !== null && (shellVariants as readonly string[]).includes(value);

export function currentShell(): ShellVariant {
  const stored = window.localStorage.getItem(KEY);
  return isVariant(stored) ? stored : "A";
}

/** What the server renders, and what hydration starts from. */
export const defaultShell = (): ShellVariant => "A";

export function pickShell(variant: ShellVariant) {
  window.localStorage.setItem(KEY, variant);
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeToShell(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** The next variant round the ring, in either direction. */
export const shellAfter = (variant: ShellVariant, step: 1 | -1) =>
  shellVariants[
    (shellVariants.indexOf(variant) + step + shellVariants.length) %
      shellVariants.length
  ];
