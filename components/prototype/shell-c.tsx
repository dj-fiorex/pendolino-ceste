"use client";

/**
 * PROTOTYPE (#shell) — variant C, "Stato".
 *
 * The chrome carries the state of the fleet rather than a list of screens: an
 * icon rail, and a rail on the right that says, wherever one is, how many
 * Ceste are Disponibili, quante sono In ritardo e quante aspettano la
 * molitura. Registering is one round button that opens the three Movimenti.
 */
import { useQuery } from "convex/react";
import { LogOutIcon, PlusIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CampagnaBar } from "@/components/campagna-bar";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import { inRitardo } from "@/lib/ceste";
import {
  allowed,
  amministrazione,
  consultazione,
  movimenti,
} from "@/lib/prototype-nav";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

/** One figure on the right rail: what it says, and how big it is. */
function RailFigure({
  label,
  value,
  note,
  href,
  tone = "plain",
}: {
  label: string;
  value: number | string;
  note?: string;
  href: string;
  tone?: "plain" | "warn";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-xl border p-4 transition-colors hover:bg-secondary/60",
        tone === "warn" ? "border-destructive/40 bg-destructive/5" : "bg-card",
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-display text-3xl font-bold tabular-nums",
          tone === "warn" && "text-destructive",
        )}
      >
        {value}
      </p>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </Link>
  );
}

function StateRail({ signedIn }: { signedIn: boolean }) {
  // Nobody signed in has nothing to be told: the queries are an Operatore's,
  // and asking them anyway is how a rail becomes an error page.
  const args = signedIn ? {} : "skip";
  const disponibili = useQuery(api.ceste.disponibiliByPortata, args);
  const attesa = useQuery(api.ceste.attesaMolitura, args);
  const recupero = useQuery(api.recupero.list, args);

  const late =
    recupero === undefined
      ? undefined
      : recupero.clienti.filter((row) =>
          row.ceste.some((cesta) =>
            inRitardo(cesta.since, recupero.sogliaRitardo),
          ),
        ).length;

  return (
    <aside className="hidden w-72 shrink-0 border-l bg-background p-4 xl:block">
      <p className="pb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Adesso al frantoio
      </p>
      <div className="grid gap-3">
        {(disponibili ?? []).map(({ portata, count }) => (
          <RailFigure
            key={portata}
            label={`Disponibili da ${portata} kg`}
            value={count}
            href="/ceste"
          />
        ))}
        <RailFigure
          label="In Attesa molitura"
          value={attesa?.length ?? "—"}
          note="Da svuotare"
          href="/attesa-molitura"
        />
        <RailFigure
          label="Clienti in ritardo"
          value={late ?? "—"}
          note="Oltre la Soglia"
          href="/recupero"
          tone={late !== undefined && late > 0 ? "warn" : "plain"}
        />
      </div>
    </aside>
  );
}

export function ShellC({ children }: { children: ReactNode }) {
  const operatore = useQuery(api.operatori.current, {});
  const pathname = usePathname();
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const isAdmin = operatore?.role === "admin";
  const rail = [...consultazione, ...amministrazione].filter((item) =>
    allowed(item, isAdmin),
  );

  return (
    <div className="flex min-h-dvh">
      <nav className="sticky top-0 hidden h-dvh w-24 shrink-0 flex-col items-center gap-1 border-r bg-card py-4 md:flex">
        <Link
          href="/"
          className={cn(
            "flex w-20 flex-col items-center gap-1 rounded-lg px-1 py-2 text-center text-[11px] leading-tight font-medium",
            pathname === "/"
              ? "bg-secondary text-secondary-foreground"
              : "text-muted-foreground hover:bg-secondary/60",
          )}
        >
          <span className="font-display text-lg font-bold">PC</span>
          Stato
        </Link>
        {rail.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex w-20 flex-col items-center gap-1 rounded-lg px-1 py-2 text-center text-[11px] leading-tight font-medium",
                active
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-secondary/60",
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={async () => {
            await authClient.signOut();
            router.replace("/accedi");
            router.refresh();
          }}
          className="mt-auto flex w-20 cursor-pointer flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium text-muted-foreground hover:bg-secondary/60"
        >
          <LogOutIcon className="size-5" aria-hidden="true" />
          Esci
        </button>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:hidden">
          <Link href="/" className="font-display text-lg font-bold">
            Pendolino
          </Link>
          {operatore && (
            <span className="text-sm text-muted-foreground">
              {operatore.name}
            </span>
          )}
        </header>

        <div className="px-4 pt-4 md:px-6">{operatore && <CampagnaBar />}</div>

        <main className="flex-1 pb-[calc(env(safe-area-inset-bottom)+6rem)] md:pb-10">
          {children}
        </main>
      </div>

      <StateRail signedIn={operatore !== null && operatore !== undefined} />

      {/* Registering is one button, in the corner the thumb owns. */}
      <button
        type="button"
        onClick={() => setSheet(true)}
        className="fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-30 flex min-h-14 cursor-pointer items-center gap-2 rounded-full bg-primary px-5 text-base font-semibold text-primary-foreground shadow-lg md:right-6 md:bottom-6"
      >
        <PlusIcon className="size-5" aria-hidden="true" />
        Registra
      </button>

      {sheet && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 md:items-center md:p-6">
          <div className="w-full max-w-md rounded-t-2xl bg-card p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:rounded-2xl">
            <div className="flex items-center justify-between pb-3">
              <p className="font-display text-xl font-bold">Cosa registri?</p>
              <Button
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label="Chiudi"
                onClick={() => setSheet(false)}
              >
                <XIcon className="size-5" />
              </Button>
            </div>
            <div className="grid gap-3">
              {movimenti.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSheet(false)}
                    className="flex min-h-16 items-center gap-4 rounded-xl bg-secondary px-4 py-3 text-secondary-foreground"
                  >
                    <Icon className="size-6 shrink-0" aria-hidden="true" />
                    <span>
                      <span className="block text-base font-semibold">
                        {item.label}
                      </span>
                      <span className="block text-sm opacity-80">
                        {item.hint}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
