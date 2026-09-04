/**
 * PROTOTYPE (#shell) — home A, "Banco".
 *
 * A dashboard: the figures first, then the three Movimenti, then the head of
 * the Lista di recupero. On the phone it is one column under the tab bar; on
 * the desktop the same blocks fall into three columns, so an Admin at the PC
 * reads the day without opening anything.
 */
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { daysSince } from "@/lib/ceste";
import { disponibiliTotal, type HomeData } from "@/lib/prototype-home";
import { movimenti } from "@/lib/prototype-nav";
import { cn } from "@/lib/utils";

function Figure({
  label,
  value,
  note,
  href,
  tone = "plain",
}: {
  label: string;
  value: number;
  note?: string;
  href: string;
  tone?: "plain" | "primary" | "warn";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-xl border p-4 transition-colors hover:bg-secondary/60",
        tone === "primary" && "border-primary/30 bg-secondary",
        tone === "warn" && "border-destructive/40 bg-destructive/5",
        tone === "plain" && "bg-card",
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-display text-4xl font-bold tabular-nums",
          tone === "warn" && "text-destructive",
        )}
      >
        {value}
      </p>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
    </Link>
  );
}

export function HomeA({ data }: { data: HomeData }) {
  const late = data.clienti.filter((cliente) => cliente.late);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-4 lg:px-8 lg:py-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight lg:text-3xl">
          Ciao {data.operatore.name}
        </h1>
        <p className="text-muted-foreground">
          Ecco come sta il frantoio adesso.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Figure
          label="Disponibili"
          value={disponibiliTotal(data)}
          note={data.disponibili
            .map(({ portata, count }) => `${count} da ${portata} kg`)
            .join(" · ")}
          href="/ceste"
          tone="primary"
        />
        <Figure
          label="Fuori con i Clienti"
          value={data.fuori}
          note={`${data.clienti.length} Clienti`}
          href="/recupero"
        />
        <Figure
          label="Attesa molitura"
          value={data.attesa}
          note="Da svuotare"
          href="/attesa-molitura"
        />
        <Figure
          label="In ritardo"
          value={late.length}
          note="Clienti oltre la Soglia"
          href="/recupero"
          tone={late.length > 0 ? "warn" : "plain"}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="grid content-start gap-3 lg:col-span-1">
          <h2 className="font-display text-lg font-semibold">Al banco</h2>
          {movimenti.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.href}
                asChild
                className="h-14 justify-start gap-3 text-base"
              >
                <Link href={item.href}>
                  <Icon className="size-5" aria-hidden="true" />
                  {item.label}
                </Link>
              </Button>
            );
          })}
        </section>

        <section className="grid content-start gap-3 lg:col-span-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">
              Da recuperare
            </h2>
            <Link
              href="/recupero"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Tutta la lista
            </Link>
          </div>
          {data.clienti.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Nessuna Cesta è Fuori: sono tutte al frantoio.
            </p>
          ) : (
            <ul className="grid gap-2">
              {data.clienti.slice(0, 5).map((cliente) => (
                <li
                  key={cliente.name}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3",
                    cliente.late && "border-destructive/40 bg-destructive/5",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {cliente.name}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {cliente.ceste === 1
                        ? "1 Cesta"
                        : `${cliente.ceste} Ceste`}
                      {cliente.since !== null &&
                        ` · da ${daysSince(cliente.since)}`}
                    </span>
                  </span>
                  {cliente.phone !== null && (
                    <Button
                      asChild
                      variant="outline"
                      className="h-11 shrink-0 px-4"
                    >
                      <a href={`tel:${cliente.phone}`}>Chiama</a>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
