"use client";

/**
 * PROTOTYPE (#shell). Throwaway: the floating pill that flips between the
 * three shells. Deliberately unlike the rest of the app, so nobody mistakes it
 * for the design being judged, and gone from a production build.
 */
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import {
  currentShell,
  defaultShell,
  pickShell,
  shellAfter,
  shellName,
  subscribeToShell,
  type ShellVariant,
} from "@/lib/prototype-shell";

export function useShellVariant(): ShellVariant {
  return useSyncExternalStore(subscribeToShell, currentShell, defaultShell);
}

/** Whether a keystroke belongs to whatever the Operatore is typing into. */
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable);

export function ShellSwitcher() {
  const variant = useShellVariant();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTyping(event.target)) {
        return;
      }
      if (event.key === "ArrowLeft") {
        pickShell(shellAfter(currentShell(), -1));
      }
      if (event.key === "ArrowRight") {
        pickShell(shellAfter(currentShell(), 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <div
      className="fixed top-[calc(env(safe-area-inset-top)+0.25rem)] left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-neutral-900 px-1 py-1 text-white shadow-lg ring-1 ring-white/20 dark:bg-white dark:text-neutral-900"
      // At the top, where no shell being judged puts a bar or a button.
      style={{ opacity: 0.92 }}
    >
      <button
        type="button"
        aria-label="Variante precedente"
        onClick={() => pickShell(shellAfter(variant, -1))}
        className="flex size-9 cursor-pointer items-center justify-center rounded-full hover:bg-white/15 dark:hover:bg-black/10"
      >
        <ChevronLeftIcon className="size-4" />
      </button>
      <span className="px-2 text-xs font-semibold tabular-nums">
        {variant} · {shellName[variant]}
      </span>
      <button
        type="button"
        aria-label="Variante successiva"
        onClick={() => pickShell(shellAfter(variant, 1))}
        className="flex size-9 cursor-pointer items-center justify-center rounded-full hover:bg-white/15 dark:hover:bg-black/10"
      >
        <ChevronRightIcon className="size-4" />
      </button>
    </div>
  );
}
