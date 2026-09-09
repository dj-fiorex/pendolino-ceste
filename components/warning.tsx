import type { ReactNode } from "react";

/**
 * The note a screen tells somebody something in without refusing them
 * anything: a Cesta that is not where the app had her, the two of six staying
 * Fuori after a partial Rientro, a mill telephone that does not look like one.
 *
 * Amber and not red, and never beside a disabled button: nothing here has gone
 * wrong and nothing here is blocked. The app records what happens at the
 * counter, it does not authorise it (ADR-0005), so a warning it shows is a
 * thing said out loud rather than a gate — and every screen says it the same
 * way, because somebody learns one shape and then reads it. Mostly the
 * counter's, since that is where the app says most without refusing; Il
 * frantoio borrows it for the one field it questions and then accepts.
 */
export function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50">
      {children}
    </p>
  );
}
