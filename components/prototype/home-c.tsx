/**
 * PROTOTYPE (#shell) — home C, "Stato".
 *
 * No list of screens and no buttons: the home *is* the fleet, in the three
 * places a Cesta can be. Each column names who is holding what, so the answer
 * to "dov'è la 17" is on the screen the app opens on. Registering is the round
 * button the shell keeps in the corner.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { cesteCount, dayOf, daysSince } from "@/lib/ceste";
import { disponibiliTotal, type HomeData } from "@/lib/prototype-home";
import { cn } from "@/lib/utils";

function Column({
  title,
  count,
  note,
  href,
  children,
  tone = "plain",
}: {
  title: string;
  count: number;
  note: string;
  href: string;
  children: ReactNode;
  tone?: "plain" | "primary" | "warn";
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-2xl border bg-card p-4">
      <Link href={href} className="group flex items-baseline gap-3">
        <span
          className={cn(
            "font-display text-4xl font-bold tabular-nums",
            tone === "primary" && "text-primary",
            tone === "warn" && "text-destructive",
          )}
        >
          {count}
        </span>
        <span className="min-w-0">
          <span className="block font-semibold group-hover:underline">
            {title}
          </span>
          <span className="block text-sm text-muted-foreground">{note}</span>
        </span>
      </Link>
      {children}
    </section>
  );
}

export function HomeC({ data }: { data: HomeData }) {
  const late = data.clienti.filter((cliente) => cliente.late);

  return (
    <div className="grid gap-4 px-4 py-4 md:px-6 md:py-6 lg:grid-cols-3 lg:gap-5">
      <Column
        title="Disponibili"
        count={disponibiliTotal(data)}
        note="Al frantoio, vuote, pronte da dare"
        href="/ceste"
        tone="primary"
      >
        <div className="grid gap-2">
          {data.disponibili.map(({ portata, count }) => (
            <div
              key={portata}
              className="flex items-center justify-between rounded-lg bg-secondary px-4 py-3"
            >
              <span className="text-sm text-secondary-foreground">
                da {portata} kg
              </span>
              <span className="font-display text-2xl font-bold text-secondary-foreground tabular-nums">
                {count}
              </span>
            </div>
          ))}
          <p className="text-sm text-muted-foreground">
            {data.totale} Ceste in tutto
            {data.dismesse > 0 && `, ${data.dismesse} Dismesse`}.
          </p>
        </div>
      </Column>

      <Column
        title="Fuori"
        count={data.fuori}
        note={`Con ${data.clienti.length} Clienti · ${late.length} in ritardo`}
        href="/recupero"
        tone={late.length > 0 ? "warn" : "plain"}
      >
        {data.clienti.length === 0 ? (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Nessuna Cesta è Fuori.
          </p>
        ) : (
          <ul className="grid gap-2">
            {data.clienti.slice(0, 6).map((cliente) => (
              <li
                key={cliente.name}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg px-3 py-2",
                  cliente.late ? "bg-destructive/5" : "bg-muted/50",
                )}
              >
                <span className="min-w-0 truncate text-sm font-medium">
                  {cliente.name}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-sm tabular-nums",
                    cliente.late ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {cliente.ceste} ·{" "}
                  {cliente.since === null ? "?" : daysSince(cliente.since)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Column>

      <Column
        title="Attesa molitura"
        count={data.attesa}
        note="Tornate piene, ancora da svuotare"
        href="/attesa-molitura"
      >
        {data.waiting.length === 0 ? (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            Niente da svuotare.
          </p>
        ) : (
          <ul className="grid gap-2">
            {data.waiting.slice(0, 6).map((load) => (
              <li
                key={`${load.cliente ?? "senza"}-${load.oldestRientro ?? 0}`}
                className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2"
              >
                <span className="min-w-0 truncate text-sm font-medium">
                  {load.cliente ?? "Senza Cliente"}
                </span>
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                  {cesteCount(load.ceste)}
                  {load.oldestRientro !== null &&
                    ` · ${dayOf(load.oldestRientro)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Column>
    </div>
  );
}
