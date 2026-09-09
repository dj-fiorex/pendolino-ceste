"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import { phoneInNational } from "@/convex/phone";
import {
  PLACEHOLDERS,
  renderTemplate,
  segmentsOf,
  tidyForSms,
  unknownPlaceholders,
  type SmsValues,
} from "@/convex/template";
import type { Cliente } from "@/lib/cliente";
import { clienteLabel } from "@/lib/cliente";

/**
 * The box the message is written in. A plain textarea rather than a component
 * of its own, dressed like the Registro's own select: this is the only screen
 * in the app that asks anybody for more than a line.
 */
const textareaClass =
  "min-h-32 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

/**
 * Whether the mill is inside the hours Italy reserves for marketing: nothing
 * before eight, nothing after ten at night, nothing at all on a Sunday.
 *
 * The app cannot tell a chase-up from a promotion, so it does not pretend to:
 * it says what the rule is and leaves the Admin to decide. Automatic receipts
 * are never held back — a farmer standing at the counter on a Sunday in
 * November has just done the thing the message describes.
 */
const outsideMarketingHours = (now: Date): boolean => {
  const read = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(read.find((part) => part.type === "hour")?.value);
  const weekday = read.find((part) => part.type === "weekday")?.value ?? "";
  return weekday.startsWith("dom") || hour < 8 || hour >= 22;
};

/** What a message costs to send, said the way the bill counts it. */
function SegmentCount({ text }: { text: string }) {
  const { characters, segments, unicode } = segmentsOf(text);
  return (
    <p className="text-sm text-muted-foreground">
      {characters} caratteri · {segments === 1 ? "1 SMS" : `${segments} SMS`}
      {unicode && (
        <span className="text-amber-700 dark:text-amber-300">
          {" "}
          · c&rsquo;è un carattere speciale: da qui in poi ogni SMS conta 70
          caratteri invece di 160.
        </span>
      )}
    </p>
  );
}

/**
 * An Admin writes to a Cliente: the chase-up no automatic receipt covers.
 *
 * Two steps on purpose. This is not counter work — it is the mill's money and
 * the mill's name going out in words nobody can take back — so the Admin reads
 * the finished sentence, the number and the cost before anything is sent.
 *
 * The preview is rendered against this Cliente's own facts, read from the
 * server, so that what is on the screen is what will arrive rather than an
 * approximation of it.
 */
export function SmsComposer({
  cliente,
  variant = "outline",
  className,
}: {
  cliente: Cliente;
  variant?: "outline" | "secondary";
  className?: string;
}) {
  const send = useMutation(api.sms.send);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const values = useQuery(
    api.sms.previewValues,
    open ? { clienteId: cliente._id } : "skip",
  );
  // Read with the dialog rather than with the screen, like the values above:
  // both call sites are an Admin's, which is what makes this query theirs to
  // ask. The mutation refuses a message with no Mittente behind it; this is
  // only the same thing said before the Admin has written anything.
  const mill = useQuery(api.frantoio.settings, open ? {} : "skip");

  const written = tidyForSms(typed).trim();
  const unknown = unknownPlaceholders(written);
  const preview =
    values === undefined
      ? written
      : renderTemplate(written, values as SmsValues);
  const noSender = mill !== undefined && mill.smsSender === "";
  const sendable = written !== "" && unknown.length === 0 && !noSender;

  const close = () => {
    setOpen(false);
    setConfirming(false);
    setTyped("");
    setError(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <DialogTrigger asChild>
        <Button variant={variant} className={className}>
          Scrivi un SMS
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {confirming ? "Mandiamo questo?" : `SMS a ${cliente.name}`}
          </DialogTitle>
          <DialogDescription>
            {cliente.phone === null
              ? "Di questo Cliente non abbiamo il telefono."
              : `Al ${phoneInNational(cliente.phone)}. Non potrà rispondere: se deve chiamare, scrivilo nel messaggio.`}
          </DialogDescription>
        </DialogHeader>

        {cliente.smsOptOut && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            {clienteLabel(cliente)} ha chiesto di non ricevere SMS. Se lo mandi
            lo stesso, resta scritto nel Registro.
          </p>
        )}

        {confirming ? (
          <div className="grid gap-3">
            <p className="rounded-lg border bg-secondary p-3 text-base whitespace-pre-wrap text-secondary-foreground">
              {preview}
            </p>
            <SegmentCount text={preview} />
            {outsideMarketingHours(new Date()) && (
              <p className="text-sm text-amber-700 dark:text-amber-300">
                In Italia i messaggi pubblicitari non si mandano dalle 22 alle 8
                né di domenica. Se questo è un sollecito puoi mandarlo lo
                stesso.
              </p>
            )}
            {error !== null && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              className="h-12 text-base"
              disabled={pending}
              onClick={async () => {
                setError(null);
                setPending(true);
                try {
                  await send({
                    clienteId: cliente._id,
                    body: written,
                    overrideOptOut: cliente.smsOptOut,
                  });
                  close();
                } catch {
                  setError(
                    "Non è stato possibile mandare l'SMS. Controlla il telefono del Cliente e riprova.",
                  );
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending ? "Un attimo…" : "Manda l'SMS"}
            </Button>
            <Button
              variant="outline"
              className="h-12 text-base"
              onClick={() => setConfirming(false)}
            >
              Torna a scrivere
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            <textarea
              aria-label="Testo dell'SMS"
              className={textareaClass}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Puoi usare {PLACEHOLDERS.map((name) => `{{${name}}}`).join(", ")}.
            </p>
            {noSender && (
              <p role="alert" className="text-sm text-destructive">
                Senza un mittente non parte niente: scegline uno in{" "}
                <Link
                  href="/frantoio"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  «Il frantoio»
                </Link>
                .
              </p>
            )}
            {unknown.length > 0 && (
              <p role="alert" className="text-sm text-destructive">
                Non so cosa scrivere al posto di{" "}
                {unknown.map((name) => `{{${name}}}`).join(", ")}.
              </p>
            )}
            {written !== "" && (
              <>
                <p className="rounded-lg border bg-secondary p-3 text-base whitespace-pre-wrap text-secondary-foreground">
                  {preview}
                </p>
                <SegmentCount text={preview} />
              </>
            )}
            <Button
              className="h-12 text-base"
              disabled={!sendable || cliente.phone === null}
              onClick={() => setConfirming(true)}
            >
              Continua
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
