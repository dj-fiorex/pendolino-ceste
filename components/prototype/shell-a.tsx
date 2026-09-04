"use client";

/**
 * PROTOTYPE (#shell) — variant A, "Banco".
 *
 * The phone gets a bottom tab bar over the four places the counter goes back
 * to all day; the desktop gets a permanent sidebar and the same screens wider.
 * The bet: what the mill does most is worth a thumb-reachable tab, and an
 * Admin at the PC wants everything visible at once.
 */
import { useQuery } from "convex/react";
import { ArchiveIcon, HomeIcon, MenuIcon, PhoneCallIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CampagnaBar } from "@/components/campagna-bar";
import { SignOutButton } from "@/components/sign-out-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import {
  allowed,
  amministrazione,
  consultazione,
  movimenti,
  type NavItem,
} from "@/lib/prototype-nav";
import { roleLabel } from "@/lib/operatore";
import { cn } from "@/lib/utils";

/** The four the thumb reaches: everything else is behind "Altro". */
const tabs = [
  { href: "/", label: "Banco", icon: HomeIcon },
  { href: "/ceste", label: "Ceste", icon: ArchiveIcon },
  { href: "/recupero", label: "Recupero", icon: PhoneCallIcon },
];

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
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

export function ShellA({ children }: { children: ReactNode }) {
  const operatore = useQuery(api.operatori.current, {});
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const isAdmin = operatore?.role === "admin";

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
          <SidebarLink
            item={{
              href: "/",
              label: "Il banco",
              hint: "",
              icon: HomeIcon,
            }}
            active={pathname === "/"}
          />
          <Section
            title="Movimenti"
            items={movimenti}
            isAdmin={isAdmin}
            pathname={pathname}
          />
          <Section
            title="Dove sono le Ceste"
            items={consultazione}
            isAdmin={isAdmin}
            pathname={pathname}
          />
          <Section
            title="Amministrazione"
            items={amministrazione}
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
          <Link href="/" className="font-display text-lg font-bold">
            Pendolino
          </Link>
          {operatore && (
            <span className="text-sm text-muted-foreground">
              {operatore.name}
            </span>
          )}
        </header>

        <div className="px-4 pt-4 lg:px-8 lg:pt-6">
          {operatore && <CampagnaBar />}
        </div>

        {/* Room under the last row for the tab bar and the phone's own bar. */}
        <main className="flex-1 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:pb-8">
          {children}
        </main>

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
            onClick={() => setMenu(true)}
            className="flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground"
          >
            <MenuIcon className="size-5" aria-hidden="true" />
            Altro
          </button>
        </nav>
      </div>

      <Dialog open={menu} onOpenChange={setMenu}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Altro</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1">
            {[...movimenti, ...consultazione, ...amministrazione]
              .filter((item) => allowed(item, isAdmin))
              .filter((item) => !tabs.some((tab) => tab.href === item.href))
              .map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenu(false)}
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
          <SignOutButton />
        </DialogContent>
      </Dialog>
    </div>
  );
}
