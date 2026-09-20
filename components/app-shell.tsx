"use client";

import { useConvexAuth, type Preloaded } from "convex/react";
import { usePreloadedAuthQuery } from "@convex-dev/better-auth/nextjs/client";
import { AccountDisabled } from "@/components/account-disabled";
import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { redirect, usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { CampagnaBar } from "@/components/campagna-bar";
import { RitiroProvider } from "@/components/ritiro-provider";
import { SignOutButton } from "@/components/sign-out-button";
import { InstallApp } from "@/components/install-app";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import {
  administration,
  allowed,
  everyScreen,
  home,
  lookups,
  movimenti,
  tabs,
  type NavItem,
} from "@/lib/nav";
import { roleLabel } from "@/lib/operatore";
import { cn } from "@/lib/utils";

/** One screen in the sidebar the PC keeps open. */
function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {item.label}
    </Link>
  );
}

/**
 * One group of the sidebar, and nothing at all where an Operatore may open
 * none of it: an empty heading would say the app has screens they cannot see.
 */
function Section({
  title,
  items,
  isAdmin,
  pathname,
}: {
  title: string;
  items: NavItem[];
  isAdmin: boolean;
  pathname: string;
}) {
  const shown = items.filter((item) => allowed(item, isAdmin));
  if (shown.length === 0) {
    return null;
  }
  return (
    <div className="grid gap-1">
      <p className="px-3 pt-4 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      {shown.map((item) => (
        <SidebarLink
          key={item.href}
          item={item}
          active={pathname === item.href}
        />
      ))}
    </div>
  );
}

/** Everything the bottom bar has no room for, one tap behind "Altro". */
function MoreMenu({
  open,
  onOpenChange,
  isAdmin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Altro</DialogTitle>
        </DialogHeader>
        <div className="grid gap-1">
          {everyScreen
            .filter((item) => allowed(item, isAdmin))
            .filter((item) => !tabs.some((tab) => tab.href === item.href))
            .map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => onOpenChange(false)}
                  className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-base font-medium hover:bg-secondary"
                >
                  <Icon
                    className="size-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  {item.label}
                </Link>
              );
            })}
        </div>
        <InstallApp />
        <SignOutButton />
      </DialogContent>
    </Dialog>
  );
}

/**
 * The chrome round every screen a signed-in Operatore opens: a bottom tab bar
 * where the app is held in one hand, a sidebar where it is read on the PC the
 * Gestionale runs on (#32).
 *
 * The Campagna hangs here rather than on each screen, because what a device
 * registers belongs to one whichever screen registers it, and the way back to
 * the home is the chrome's now — no screen carries its own "Indietro".
 */
type ShellProps = {
  children: ReactNode;
  preloadedOperatore: Preloaded<typeof api.operatori.current>;
  preloadedCampagne: Preloaded<typeof api.campagne.list> | null;
};

// A reauthenticated connection can still be waiting for its first query result.
// Undefined means pending; null remains a real result, including deactivation.
function useLastDefined<T>(value: T | undefined) {
  const [last, setLast] = useState(value);
  useEffect(() => {
    if (value !== undefined) setLast(value);
  }, [value]);
  return value === undefined ? last : value;
}

function PreloadedCampagnaBar({
  query,
}: {
  query: Preloaded<typeof api.campagne.list>;
}) {
  const campagne = useLastDefined(usePreloadedAuthQuery(query));
  return <CampagnaBar campagne={campagne ?? undefined} />;
}

function Chrome({
  children,
  pathname,
  preloadedOperatore,
  preloadedCampagne,
}: ShellProps & { pathname: string }) {
  const operatore = useLastDefined(usePreloadedAuthQuery(preloadedOperatore));
  const [more, setMore] = useState(false);
  const isAdmin = operatore?.role === "admin";

  // An account an Admin has deactivated is signed in and has nowhere to go:
  // it gets the card that says so, and no chrome round it that would offer
  // screens it will only be turned away from.
  if (operatore == null) {
    return <AccountDisabled />;
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-card p-3 lg:flex">
        <div className="px-3 py-4">
          <p className="font-display text-lg font-bold tracking-tight">
            Pendolino Ceste
          </p>
          {operatore && (
            <p className="text-sm text-muted-foreground">
              {operatore.name} · {roleLabel[operatore.role]}
            </p>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto">
          <SidebarLink item={home} active={pathname === home.href} />
          <Section
            title="Movimenti"
            items={movimenti}
            isAdmin={isAdmin}
            pathname={pathname}
          />
          <Section
            title="Dove sono le Ceste"
            items={lookups}
            isAdmin={isAdmin}
            pathname={pathname}
          />
          <Section
            title="Amministrazione"
            items={administration}
            isAdmin={isAdmin}
            pathname={pathname}
          />
        </nav>
        <div className="pt-3">
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <Link href={home.href} className="font-display text-lg font-bold">
            Pendolino
          </Link>
          {operatore && (
            <span className="text-sm text-muted-foreground">
              {operatore.name}
            </span>
          )}
        </header>

        {preloadedCampagne && (
          <div className="px-4 pt-4 lg:px-8 lg:pt-6">
            <PreloadedCampagnaBar query={preloadedCampagne} />
          </div>
        )}

        {/* Room under the last row for the tab bar and the phone's own bar.
            The screen inside carries its own <main>, as every screen does. */}
        <div className="flex-1 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:pb-8">
          <RitiroProvider key={operatore.email}>{children}</RitiroProvider>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {tab.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMore(true)}
            className="flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground"
          >
            <MenuIcon className="size-5" aria-hidden="true" />
            Altro
          </button>
        </nav>
      </div>

      <MoreMenu open={more} onOpenChange={setMore} isAdmin={isAdmin} />
    </div>
  );
}

/** Server-authorized content stays mounted while the browser authenticates. */
export function AppShell(props: ShellProps) {
  const pathname = usePathname();
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (!isLoading && !isAuthenticated) {
    redirect("/accedi");
  }

  return <Chrome pathname={pathname} {...props} />;
}
