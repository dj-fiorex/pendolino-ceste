"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Warning } from "@/components/warning";
import { api } from "@/convex/_generated/api";
import { readPhone } from "@/convex/phone";
import { MAX_MILL_TEXT, MAX_SMS_SENDER } from "@/convex/schema";
import { smsSenderProblem } from "@/convex/template";
import { daysLabel } from "@/lib/ceste";

/**
 * The Mittente a name suggests: the name itself, cut to what a carrier takes
 * and stripped of what it will not carry — an accent, a full stop, the second
 * half of "Frantoio Pendolino".
 *
 * Only ever a suggestion. It is offered into an empty box and never over
 * anything, so an Admin who wants a different Mittente types one and is not
 * argued with. Where nothing usable survives the cut, it suggests nothing.
 */
const suggestedSender = (millName: string) => {
  const usable = millName
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SMS_SENDER)
    .trim();
  return /[A-Za-z]/.test(usable) ? usable : "";
};

/**
 * What the mill has settled about itself: the name and the telephone a Cliente
 * reads on an Etichetta and inside an Sms, and the Mittente its Sms arrive
 * from.
 *
 * Three fields on one card and one Salva, because they are one thought — this
 * is who we are — and because they are written by the same mutation and land
 * in the Registro as one sentence.
 */
function FrantoioCard({
  settings,
}: {
  settings: { millName: string; millPhone: string; smsSender: string };
}) {
  const save = useMutation(api.frantoio.setSettings);
  // The Admin's own edit, kept as they typed it and started from what the mill
  // is running on. Nothing is written until they say so.
  const [draft, setDraft] = useState<typeof settings | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const wanted = draft ?? settings;
  const change = (fields: Partial<typeof wanted>) => {
    setSaved(false);
    setDraft({ ...wanted, ...fields });
  };

  /**
   * A first Mittente, out of the name just typed. A hint and not a link: it
   * only ever fills a Mittente nobody has written, and typing over it settles
   * the matter for good. Eighteen characters of "Frantoio Pendolino" do not
   * fit in eleven, so the two have to be allowed to differ — what they must
   * not do is drift apart on their own.
   */
  const nameTyped = (millName: string) =>
    change(
      wanted.smsSender === ""
        ? { millName, smsSender: suggestedSender(millName) }
        : { millName },
    );
  const untouched =
    wanted.millName.trim() === settings.millName &&
    wanted.millPhone.trim() === settings.millPhone &&
    wanted.smsSender.trim() === settings.smsSender;

  // Said out loud and not refused: a frantoio knows its own telephone better
  // than a rule for Italian numbering does, and this number is printed and
  // texted rather than dialled by the app (ADR-0009 governs the one that is
  // dialled, which is a Cliente's).
  const phoneOdd =
    wanted.millPhone.trim() !== "" &&
    readPhone(wanted.millPhone).kind === "unreadable";
  // Refused, because a Mittente the carrier will not take is not a number
  // somebody can read past: it is a message that never arrives.
  const senderProblem = smsSenderProblem(wanted.smsSender.trim());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Il frantoio</CardTitle>
        <CardDescription>
          Come ci chiamiamo e come ci si trova. Il nome e il telefono finiscono
          in fondo alle Etichette e dentro gli SMS.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-5"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            setPending(true);
            try {
              await save({
                millName: wanted.millName.trim(),
                millPhone: wanted.millPhone.trim(),
                smsSender: wanted.smsSender.trim(),
              });
              setDraft(null);
              setSaved(true);
            } catch {
              setError("Non è stato possibile salvare. Riprova.");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="millName">Nome del frantoio</Label>
            <Input
              id="millName"
              value={wanted.millName}
              maxLength={MAX_MILL_TEXT}
              onChange={(event) => nameTyped(event.target.value)}
              className="h-12 text-base"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="millPhone">Telefono</Label>
            <Input
              id="millPhone"
              type="tel"
              inputMode="tel"
              value={wanted.millPhone}
              maxLength={MAX_MILL_TEXT}
              onChange={(event) => change({ millPhone: event.target.value })}
              className="h-12 text-base tabular-nums"
            />
            <p className="text-sm text-muted-foreground">
              Scrivilo come vuoi che si legga: è quello che stampiamo e che
              mandiamo, non uno che l&rsquo;app compone.
            </p>
            {phoneOdd && (
              <Warning>
                Questo numero non sembra un telefono. Lo salviamo lo stesso, ma
                dagli un&rsquo;occhiata.
              </Warning>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="smsSender">Mittente SMS</Label>
            <Input
              id="smsSender"
              value={wanted.smsSender}
              maxLength={MAX_SMS_SENDER}
              onChange={(event) => change({ smsSender: event.target.value })}
              className="h-12 text-base"
            />
            <p className="text-sm text-muted-foreground">
              Il nome da cui il Cliente vede arrivare l&rsquo;SMS.{" "}
              {MAX_SMS_SENDER} caratteri, lettere non accentate, numeri e
              spazi. A un SMS così non si può rispondere: per questo il
              telefono va anche dentro il messaggio.
            </p>
            {senderProblem !== null && (
              <p role="alert" className="text-sm text-destructive">
                {senderProblem}
              </p>
            )}
            {senderProblem === null && wanted.smsSender.trim() === "" && (
              <Warning>
                Senza mittente il frantoio non manda SMS. Gli invii automatici
                restano spenti finché non ne scrivi uno.
              </Warning>
            )}
          </div>

          {error !== null && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {saved && <p className="text-sm text-muted-foreground">Salvato.</p>}
          <Button
            type="submit"
            className="h-12 text-base"
            disabled={pending || untouched || senderProblem !== null}
          >
            {pending ? "Un attimo…" : "Salva"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * The Soglia di ritardo, as an Admin changes it. One number for the whole
 * mill, and all it decides is which rows of the Lista di recupero are
 * coloured: the list is the same list at one day and at a hundred, which is
 * what makes the setting safe to get wrong (#22).
 *
 * Its own card and its own Salva beside the three above, because it is a
 * number with a rule of its own and does not belong in a save that trims text.
 */
function SogliaCard({ sogliaRitardo }: { sogliaRitardo: number }) {
  const setSogliaRitardo = useMutation(api.frantoio.setSogliaRitardo);
  // The box is the Admin's own edit, kept as they typed it; what the mill is
  // actually running on is read live beside it, so that a Soglia changed on
  // another device never hides behind a half-typed number here.
  const [typed, setTyped] = useState(String(sogliaRitardo));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = Number(typed);
  const isDays = Number.isInteger(days) && days >= 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Soglia di ritardo</CardTitle>
        <CardDescription>
          Adesso è {daysLabel(sogliaRitardo)}. Dopo quanti giorni Fuori una
          Cesta è In ritardo: colora le righe della{" "}
          <Link
            href="/recupero"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Lista di recupero
          </Link>{" "}
          e basta, non toglie nessuno dall&rsquo;elenco.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            setPending(true);
            try {
              await setSogliaRitardo({ days });
            } catch {
              setError("Non è stato possibile salvare. Riprova.");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="soglia-ritardo">Giorni</Label>
            <Input
              id="soglia-ritardo"
              name="soglia-ritardo"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              className="h-11"
            />
          </div>
          {!isDays && (
            <p role="alert" className="text-sm text-destructive">
              Un numero intero di giorni, da 1 in su.
            </p>
          )}
          {error !== null && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="h-12 text-base"
            disabled={pending || !isDays || days === sogliaRitardo}
          >
            {pending ? "Un attimo…" : "Salva la Soglia"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Il frantoio: what the mill has settled about itself, as against what an
 * Operatore settles at the counter.
 *
 * Four things, on two cards that save separately. What lives here and what
 * does not is a rule rather than a habit: a setting whose effect you can watch
 * while you change it stays on the screen that shows it — the Etichetta's size
 * and the words of an Sms both redraw a preview — and a setting you can only
 * state comes here (ADR-0011).
 */
export function FrantoioAdmin() {
  const settings = useQuery(api.frantoio.settings, {});

  if (settings === undefined) {
    return <p className="text-sm text-muted-foreground">Un attimo…</p>;
  }

  return (
    <div className="grid gap-6">
      <FrantoioCard
        settings={{
          millName: settings.millName,
          millPhone: settings.millPhone,
          smsSender: settings.smsSender,
        }}
      />
      <SogliaCard sogliaRitardo={settings.sogliaRitardo} />
    </div>
  );
}
