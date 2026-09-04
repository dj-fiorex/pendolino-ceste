"use client";

/**
 * PROTOTYPE (#shell) — variant B, "Azioni".
 *
 * No permanent navigation anywhere: the three Movimenti sit in the top bar as
 * buttons, and everything else is behind one full-screen menu. The bet: at the
 * counter one never browses, one registers — so the chrome should carry the
 * three verbs and get out of the way.
 */
import { useQuery } from "convex/react";
import { MenuIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { CampagnaBar } from "@/components/campagna-bar";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
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

function MenuGroup({
  title,
  items,
  isAdmin,
  onGo,
}: {
  title: string;
  items: NavItem[];
  isAdmin: boolean;
  onGo: () => void;
}) {
  const shown = items.filter((item) => allowed(item, isAdmin));
  if (shown.length === 0) {
    return null;
  }
  return (
    <section className="grid gap-2">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      {shown.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onGo}
            className="flex min-h-16 items-center gap-4 rounded-xl border bg-card px-4 py-3 hover:bg-secondary/60"
          >
            <Icon
              className="size-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span>
              <span className="block text-base font-semibold">
                {item.label}
              </span>
              <span className="block text-sm text-muted-foreground">
                {item.hint}
              </span>
            </span>
          </Link>
        );
      })}
    </section>
  );
}

export function ShellB({ children }: { children: ReactNode }) {
  const operatore = useQuery(api.operatori.current, {});
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const isAdmin = operatore?.role === "admin";

  // The menu covers the screen: a screen behind it should not scroll under it.
  useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menu]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2 md:px-6">
          <Link href="/" className="font-display text-lg font-bold">
            Pendolino<span className="hidden sm:inline"> Ceste</span>
          </Link>

          <nav className="ml-auto hidden items-center gap-2 md:flex">
            {movimenti.map((item) => (
              <Button
                key={item.href}
                asChild
                variant={pathname === item.href ? "default" : "secondary"}
                className="h-11 px-4 text-base"
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
          </nav>

          <Button
            variant="outline"
            className="ml-auto h-11 gap-2 px-3 md:ml-3"
            onClick={() => setMenu(true)}
          >
            <MenuIcon className="size-5" aria-hidden="true" />
            Menu
          </Button>
        </div>

        {/* The phone keeps the three verbs in reach without a tab bar: one
            scrollable row of the only buttons the counter needs. */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-2 md:hidden">
          {movimenti.map((item) => (
            <Button
              key={item.href}
              asChild
              variant={pathname === item.href ? "default" : "secondary"}
              className="h-11 shrink-0 px-4 text-base"
            >
              <Link href={item.href}>{item.label}</Link>
            </Button>
          ))}
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 pt-4 md:px-6">
        {operatore && <CampagnaBar />}
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 pb-16">{children}</main>

      {menu && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-background">
          <div className="mx-auto grid w-full max-w-2xl gap-6 p-4 pb-24 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-2xl font-bold tracking-tight">
                  Menu
                </p>
                {operatore && (
                  <p className="text-sm text-muted-foreground">
                    {operatore.name} · {roleLabel[operatore.role]}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="size-11"
                aria-label="Chiudi"
                onClick={() => setMenu(false)}
              >
                <XIcon className="size-5" />
              </Button>
            </div>
            <MenuGroup
              title="Movimenti"
              items={movimenti}
              isAdmin={isAdmin}
              onGo={() => setMenu(false)}
            />
            <MenuGroup
              title="Dove sono le Ceste"
              items={consultazione}
              isAdmin={isAdmin}
              onGo={() => setMenu(false)}
            />
            <MenuGroup
              title="Amministrazione"
              items={amministrazione}
              isAdmin={isAdmin}
              onGo={() => setMenu(false)}
            />
            <div className={cn("pt-2")}>
              <SignOutButton />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
