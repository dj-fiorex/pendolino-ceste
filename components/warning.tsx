import type { ReactNode } from "react";

/**
 * The note a counter screen tells the Operatore something in without refusing
 * them anything: a Cesta that is not where the app had her, the two of six
 * staying Fuori after a partial Rientro.
 *
 * Amber and not red, and never beside a disabled button: nothing here has gone
 * wrong and nothing here is blocked. The app records what happens at the
 * counter, it does not authorise it (ADR-0005), so a warning it shows is a
 * thing said out loud rather than a gate — and the three screens say it the
 * same way, because an Operatore learns one shape and then reads it.
 */
export function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50">
      {children}
    </p>
  );
}
