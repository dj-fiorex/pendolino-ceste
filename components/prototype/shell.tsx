"use client";

/**
 * PROTOTYPE (#shell). Throwaway: picks the shell the device is set to, and
 * hangs the switcher on top of it. The screens inside are the real ones.
 *
 * Signing in and setting a password are shown bare: there is nothing to
 * navigate to yet, and the shells all read the Operatore.
 */
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ShellA } from "@/components/prototype/shell-a";
import { ShellB } from "@/components/prototype/shell-b";
import { ShellC } from "@/components/prototype/shell-c";
import {
  ShellSwitcher,
  useShellVariant,
} from "@/components/prototype/switcher";

export function PrototypeShell({ children }: { children: ReactNode }) {
  const variant = useShellVariant();
  const pathname = usePathname();

  if (pathname.startsWith("/accedi") || pathname.startsWith("/password")) {
    return (
      <>
        {children}
        <ShellSwitcher />
      </>
    );
  }

  return (
    <>
      {variant === "A" && <ShellA>{children}</ShellA>}
      {variant === "B" && <ShellB>{children}</ShellB>}
      {variant === "C" && <ShellC>{children}</ShellC>}
      <ShellSwitcher />
    </>
  );
}
