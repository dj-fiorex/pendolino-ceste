/**
 * PROTOTYPE (#shell) — home B, "Azioni".
 *
 * The home is three doors and nothing else: Ritiro, Rientro, Svuotamento, each
 * a tile the size of a hand, with the one figure that matters to it printed on
 * it. What the frantoio's state is lives one line under them, and the screens
 * that answer it are a tap away. On the desktop the doors sit on the left and
 * the state on the right, as two columns of one page.
 */
import Link from "next/link";
import { daysSince } from "@/lib/ceste";
import { disponibiliTotal, type HomeData } from "@/lib/prototype-home";
import { consultazione, movimenti } from "@/lib/prototype-nav";
import { cn } from "@/lib/utils";

/** The figure each door carries: what it will be working on. */
const doorNote = (href: string, data: HomeData) => {
  if (href === "/ritiro") {
    return `${disponibiliTotal(data)} Ceste pronte da dare`;
  }
  if (href === "/rientro") {
    return `${data.fuori} Fuori con ${data.clienti.length} Clienti`;
  }
  return `${data.attesa} in Attesa molitura`;
};

export function HomeB({ data }: { data: HomeData }) {
  const late = data.clienti.filter((cliente) => cliente.late);

  return (
    <div className="grid gap-6 px-4 py-4 md:px-6 md:py-6 lg:grid-cols-[3fr_2fr] lg:gap-8">
      <section className="grid gap-3 md:gap-4">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Cosa registri, {data.operatore.name}?
        </h1>
        {movimenti.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-28 items-center gap-4 rounded-2xl bg-primary p-5 text-primary-foreground transition-opacity hover:opacity-90 md:min-h-32"
            >
              <Icon className="size-9 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block font-display text-2xl font-bold tracking-tight md:text-3xl">
                  {item.label}
                </span>
                <span className="block text-sm opacity-90">{item.hint}</span>
                <span className="block pt-1 text-sm font-semibold tabular-nums opacity-90">
                  {doorNote(item.href, data)}
                </span>
              </span>
            </Link>
          );
        })}
      </section>

      <section className="grid content-start gap-3">
        <h2 className="font-display text-lg font-semibold">Il frantoio ora</h2>
        <div
          className={cn(
            "rounded-2xl border bg-card p-4",
            late.length > 0 && "border-destructive/40",
          )}
        >
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm text-muted-foreground">Disponibili</dt>
              <dd className="font-display text-3xl font-bold tabular-nums">
                {disponibiliTotal(data)}
              </dd>
              <dd className="text-sm text-muted-foreground">
                {data.disponibili
                  .map(({ portata, count }) => `${count} da ${portata}`)
                  .join(" · ")}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Fuori</dt>
              <dd className="font-display text-3xl font-bold tabular-nums">
                {data.fuori}
              </dd>
              <dd className="text-sm text-muted-foreground">
                {data.clienti.length} Clienti
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Attesa molitura</dt>
              <dd className="font-display text-3xl font-bold tabular-nums">
                {data.attesa}
              </dd>
              <dd className="text-sm text-muted-foreground">
                {data.waiting.length === 0
                  ? "Niente da svuotare"
                  : `${data.waiting.length} carichi`}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">In ritardo</dt>
              <dd
                className={cn(
                  "font-display text-3xl font-bold tabular-nums",
                  late.length > 0 && "text-destructive",
                )}
              >
                {late.length}
              </dd>
              <dd className="text-sm text-muted-foreground">
                {late.length === 0
                  ? "Nessuno oltre la Soglia"
                  : `Il primo da ${daysSince(late[0].since ?? Date.now())}`}
              </dd>
            </div>
          </dl>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {consultazione.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-4 text-base font-medium hover:bg-secondary/60"
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
      </section>
    </div>
  );
}
