"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { CestaReader } from "@/components/cesta-reader";
import { CestaTile } from "@/components/cesta-tile";
import { ClientePicker } from "@/components/cliente-picker";
import { RitiroMedia } from "@/components/ritiro-media";
import { useRitiro } from "@/components/use-ritiro";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Warning } from "@/components/warning";
import { api } from "@/convex/_generated/api";
import { phoneInNational } from "@/convex/phone";
import { expectedBefore } from "@/convex/schema";
import {
  cesteCount,
  dayOf,
  daysSince,
  oldestSince,
  warningLine,
  type FoundCesta,
} from "@/lib/ceste";
import { clienteInSentence, clienteLabel } from "@/lib/cliente";
import { mediaListed, toRetakeLine } from "@/lib/media";
import type { RitiroDraft } from "@/lib/ritiro-draft";

/**
 * Whether the app had a Cesta where a Ritiro expects to find her: at the mill,
 * empty, ready for the next Cliente. One rule in two voices — the mutation
 * writes the Rettifica of *discrepanza* by it, and this screen writes the
 * warning by it (ADR-0005, #21).
 */
const asExpected = (cesta: FoundCesta) => cesta.state === expectedBefore.ritiro;

/**
 * The Ritiro this device was left in the middle of, held out to whoever has
 * the phone now (#24).
 *
 * Held out and never put back by itself. The Ceste of a Ritiro are scans with
 * nothing on them saying who scanned them, and a phone goes round a counter
 * where five Operatori work a hundred and fifty people: an app that quietly
 * reopened Giuseppe's four Ceste while Antonio was standing there would attach
 * one man's load to another man's name, and nobody would see it happen. So the
 * draft is named — whose Ritiro, how many Ceste — and answered before anything
 * of it is on screen.
 *
 * Both answers are one tap, and refusing is as plain as taking it: nothing
 * here has gone wrong, and no Cesta has left the yard on this Ritiro yet.
 */
function ResumeOffer({
  draft,
  onResume,
  onAbandon,
}: {
  draft: RitiroDraft;
  onResume: () => void;
  onAbandon: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Un Ritiro lasciato a metà</CardTitle>
        <CardDescription>
          Nessuna Cesta è ancora uscita: riprendilo, oppure ricomincia da capo.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {/* Said before the Operatore decides, because it is part of what
            resuming gets them: what they took is not in there, and somebody
            who had the Cliente sign must not confirm believing it is (#25). */}
        {draft.notKept.length > 0 && (
          <Warning>{toRetakeLine(draft.notKept)}</Warning>
        )}
        {/* Wrapping rather than nowrap, alone among the buttons at the
            counter: this one carries a Cliente's name and his Soprannomi, and
            the one thing it must never do is run "Giuseppe Amato (Turi)" off
            the side of a phone held in one hand. */}
        <Button
          className="h-auto min-h-14 w-full px-4 py-3 text-base whitespace-normal"
          onClick={onResume}
        >
          Riprendi il Ritiro di {clienteInSentence(draft.cliente)} ·{" "}
          {cesteCount(draft.ceste.length)}
        </Button>
        {/* Not "annulla": nothing here is annulled, because nothing here has
            been recorded yet, and *annullamento* is a word the mill does not
            use of a Ritiro (CONTEXT.md). Starting again is what this does and
            what it says. */}
        <Button
          variant="outline"
          className="h-12 w-full text-base"
          onClick={onAbandon}
        >
          Ricomincia da capo
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * The counter: the Cliente in front of the Operatore, then their Ceste one at
 * a time, then the Ritiro.
 *
 * Variant B of the prototype the mill chose (#31), the same shape as the
 * Rientro: the Ceste of this Ritiro are tiles a tap takes back off, and the
 * camera, the numero and the confirmation sit together in the bar at the
 * bottom — the camera never behind a switch, because a label on a stacked
 * Cesta can be on the face nobody can see (#23).
 */
export function RitiroFlow() {
  const { ritiro, state } = useRitiro();
  const selectedCliente =
    state.phase === "editing" || state.phase === "recording"
      ? state.cliente
      : null;
  const held = useQuery(
    api.clienti.get,
    selectedCliente === null ? "skip" : { clienteId: selectedCliente._id },
  );

  if (state.phase === "recorded") {
    const done = state;
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ritiro registrato</CardTitle>
          <CardDescription>
            {cesteCount(done.count)} a {clienteLabel(done.cliente)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {/* Said after the fact and never before it: what the Operatore took
              did not go up, the Ritiro went through anyway, and they hear it
              rather than finding out in November (ADR-0005, #25). */}
          {done.notUploaded.length > 0 && (
            <Warning>
              {`Il Ritiro è registrato, ma ${mediaListed(done.notUploaded)} ${
                done.notUploaded.length === 1
                  ? "non è stata caricata"
                  : "non sono state caricate"
              }.`}
            </Warning>
          )}
          <Button className="h-12 text-base" onClick={ritiro.startAnother}>
            Nuovo Ritiro
          </Button>
          <Button variant="outline" asChild className="h-12 text-base">
            <Link href="/">Torna all&apos;inizio</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (state.phase === "loading") return null;

  if (state.phase === "offering") {
    return (
      <ResumeOffer
        draft={state.draft}
        onResume={ritiro.resume}
        onAbandon={ritiro.abandon}
      />
    );
  }

  const {
    cliente,
    ceste,
    captured,
    failed,
    mustAsk,
    toRetake: stillToRetake,
  } = state;
  const pending = state.phase === "recording";
  if (cliente === null) {
    return <ClientePicker onPick={ritiro.chooseCliente} pickLabel="Ritiro" />;
  }

  // The Ceste of this Ritiro the app did not have Disponibile, in the order
  // they were added: each of them goes out with a Rettifica beside her.
  const notWhereTheAppHadThem = ceste.filter((cesta) => !asExpected(cesta));

  // What this Cliente is holding already, by numero, and since when the oldest
  // of them has been his. Undefined while the read is still in flight, which
  // is not the same as his holding nothing: the screen says which it is.
  const alreadyOut = held?.cesteFuori;
  const oldestOut = oldestSince(alreadyOut ?? []);

  return (
    <fieldset
      disabled={pending}
      aria-busy={pending}
      aria-label="Ritiro"
      className="grid min-w-0 gap-4 pb-4"
    >
      <Card>
        <CardHeader>
          <CardTitle>{clienteLabel(cliente)}</CardTitle>
          <CardDescription>
            {/* Il telefono di chi è al banco, o che non ce l'abbiamo: è
                l'unico momento in cui glielo si può chiedere. Non dice niente
                degli SMS — al banco non servono a niente (ADR-0005). */}
            {cliente.phone === null
              ? "Telefono non lo sappiamo"
              : phoneInNational(cliente.phone)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="h-11 w-full text-base"
            onClick={ritiro.changeCliente}
          >
            Cambia Cliente
          </Button>
        </CardContent>
      </Card>

      {/* What he already has out, said as soon as he is picked and before
          anything is confirmed. Which ones by numero, each with the day the
          Ritiro that took her out was registered, because the argument over
          "two or three" happens here, in front of an Operatore who cannot read
          the Registro (#22).

          It never gates the button: the Ceste are on the trailer either way
          and the counter is never blocked (ADR-0005). */}
      {alreadyOut === undefined ? (
        // Not "he has none": the app has not finished asking. Said out loud,
        // because an Operatore who saw nothing would take that for an answer
        // and confirm a Ritiro the warning never got to appear on.
        <p className="text-sm text-muted-foreground">
          Guardo se ha già Ceste Fuori…
        </p>
      ) : (
        alreadyOut.length > 0 && (
          <Warning>
            <span className="font-semibold">
              Ha già {cesteCount(alreadyOut.length)} Fuori
              {oldestOut === null ? "" : `, da ${daysSince(oldestOut)}`}:
            </span>{" "}
            {alreadyOut
              .map((cesta) =>
                cesta.since === null
                  ? `${cesta.numero}`
                  : `${cesta.numero} dal ${dayOf(cesta.since)}`,
              )
              .join(" · ")}
            . Il Ritiro va avanti lo stesso.
          </Warning>
        )
      )}

      <div className="flex items-baseline justify-between text-sm text-muted-foreground">
        <span>Questo Ritiro · tocca per togliere</span>
        <span>{cesteCount(ceste.length)}</span>
      </div>

      {ceste.length === 0 ? (
        <p className="text-muted-foreground">
          Ancora nessuna Cesta. Lo zero davanti al numero non serve.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {ceste.map((cesta) => (
            <li key={cesta._id}>
              {/* Every tile here is a Cesta going out, so every one is filled:
                  a tap is what takes her back out of the Ritiro. */}
              <CestaTile
                codice={cesta.codice}
                selected
                onToggle={() => ritiro.removeCesta(cesta._id)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Said once as each Cesta goes in, and then again here for as long as
          she is in the Ritiro: a warning that has scrolled away is a warning
          nobody sees at the moment they confirm. It never gates the button —
          the Cesta is on the trailer either way (ADR-0005). */}
      {notWhereTheAppHadThem.length > 0 && (
        <Warning>
          <span className="font-semibold">
            {notWhereTheAppHadThem.length === 1
              ? "La registro lo stesso, con una Rettifica:"
              : "Le registro lo stesso, con una Rettifica per ognuna:"}
          </span>{" "}
          {notWhereTheAppHadThem.map(warningLine).join(" · ")}.
        </Warning>
      )}

      {failed && (
        <p role="alert" className="text-sm text-destructive">
          Non è stato possibile registrare il Ritiro. Controlla la connessione e
          riprova.
        </p>
      )}

      {/* Said on the offer that brought this Ritiro back, and then again here
          for as long as it stands, beside the buttons that would take it
          again: the offer has scrolled away by the time anybody confirms, and
          a Ritiro confirmed in the belief that the Cliente's signature is on
          it is the one thing worse than a Ritiro with no signature (#24). */}
      {stillToRetake.length > 0 && (
        <Warning>{toRetakeLine(stillToRetake)}</Warning>
      )}

      {/* Offered here, the last thing before the bar that confirms, and asked
          for nowhere: a Ritiro is confirmed on the same one tap whether or not
          either of them was taken (#25). */}
      <RitiroMedia
        captured={captured}
        onCapture={ritiro.capture}
        onRemove={ritiro.removeMedia}
        disabled={pending}
      />

      <div className="sticky bottom-4 grid gap-3 rounded-xl border bg-card p-3 shadow-lg">
        {!pending && (
          <CestaReader
            label="Numero della Cesta"
            submitLabel="Aggiungi"
            codici={ceste.map((cesta) => cesta.codice)}
            onCesta={ritiro.addCesta}
          />
        )}
        <Button
          className="h-14 w-full text-lg"
          disabled={!state.canConfirm}
          onClick={() => void ritiro.confirm()}
        >
          {pending
            ? "Un attimo…"
            : mustAsk
              ? "Scegli prima la Campagna"
              : `Conferma Ritiro · ${cesteCount(ceste.length)}`}
        </Button>
      </div>
    </fieldset>
  );
}
