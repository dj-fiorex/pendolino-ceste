"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DraftStorageError,
  InterruptedConfirmation,
} from "@/components/movement-draft";
import {
  useMovementActivity,
  useMovementConnection,
} from "@/components/pwa-provider";
import { useCampagnaChoice } from "@/components/campagna-bar";
import { CestaReader } from "@/components/cesta-reader";
import { CestaTile } from "@/components/cesta-tile";
import { ClientePicker } from "@/components/cliente-picker";
import {
  NOTHING_CAPTURED,
  RitiroMedia,
  type CapturedMedia,
} from "@/components/ritiro-media";
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
import { expectedBefore, type MediaKind } from "@/convex/schema";
import {
  cesteCount,
  dayOf,
  daysSince,
  oldestSince,
  warningLine,
  whereTheAppHasHer,
  type FoundCesta,
} from "@/lib/ceste";
import { clienteInSentence, clienteLabel, type Cliente } from "@/lib/cliente";
import { mediaKinds, mediaListed, toRetakeLine, upload } from "@/lib/media";
import {
  forgetDraft,
  readDraft,
  writeDraft,
  type RitiroDraft,
} from "@/lib/ritiro-draft";

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
          Riprendi il lavoro salvato su questo dispositivo, oppure ricomincia da
          capo.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {draft.confirmationPending && <InterruptedConfirmation />}
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
  const connected = useMovementConnection();
  const recordRitiro = useMutation(api.movimenti.ritiro);
  const askWhereToPutIt = useMutation(api.media.uploadUrl);
  const { campagnaId, mustAsk } = useCampagnaChoice();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [ceste, setCeste] = useState<FoundCesta[]>([]);
  const [captured, setCaptured] = useState<CapturedMedia>(NOTHING_CAPTURED);
  const [failed, setFailed] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<{
    cliente: Cliente;
    count: number;
    /**
     * What was taken and did not go up. The Ritiro is registered regardless:
     * the Ceste are on the trailer, and an upload that failed is not a reason
     * to hold the counter (ADR-0005).
     */
    notUploaded: MediaKind[];
  } | null>(null);
  /**
   * The Ritiro this device was holding when this screen opened, and what has
   * become of the question it asks. Three answers, and the flow below is only
   * itself on the last of them: `undefined` while the device is still being
   * read, the draft itself while the Operatore has it in front of them and has
   * not said, and `null` once they have — or once it turned out there was
   * nothing to ask about (#24).
   */
  const [offer, setOffer] = useState<RitiroDraft | null | undefined>(undefined);
  /**
   * What was taken on this Ritiro and is not on this device any more: the
   * signature or the photograph of a Ritiro that has been resumed, which the
   * draft names and deliberately does not carry (#24, #25).
   *
   * Carried in its own right rather than read off what is captured, because it
   * is a fact about the Ritiro and not about the run of the screen: an
   * Operatore who resumes, is told the signature is gone, and then locks the
   * phone again must be told the same thing the second time.
   */
  const [toRetake, setToRetake] = useState<MediaKind[]>([]);
  useMovementActivity(
    done === null && (cliente !== null || ceste.length > 0),
    pending,
    !storageFailed,
  );

  // Read once, when this screen opens, and never again: what the device is
  // holding is a question asked at the start of a Ritiro, not a thing this
  // screen goes on watching. Read here rather than at the first render because
  // a server has no device to read, and a screen that said one thing on the
  // server and another on the phone would be a screen React refuses to keep.
  useEffect(() => {
    setOffer(readDraft());
  }, []);

  // What this Cliente is already holding, before a single Cesta of this Ritiro
  // is added: the Cliente's own read, the one the Rientro and his page make.
  const held = useQuery(
    api.clienti.get,
    cliente === null ? "skip" : { clienteId: cliente._id },
  );

  /**
   * The Ritiro as it stands, written down on the device after every change to
   * it: one more Cesta scanned, one taken back off, the signature taken (#24).
   *
   * Written from here rather than at each of the four places that change it,
   * so that a Ritiro can never be a Cesta ahead of what the device is holding:
   * whatever is on screen is what a reload gets back.
   *
   * Three moments write nothing at all. While the device is still being read,
   * because an empty screen would wipe the very draft about to be offered.
   * While the offer is up and unanswered, because the flow beneath it is empty
   * and that emptiness is not a Ritiro anybody built. And once the Ritiro is
   * registered, because it is the mill's record from then on and the draft has
   * been deliberately forgotten.
   */
  useEffect(() => {
    if (offer !== null || done !== null) {
      return;
    }
    if (ceste.length === 0 && cliente === null) {
      forgetDraft();
      return;
    }
    // Changing Cliente leaves the Ceste where they are, because they are in the
    // yard whoever is taking them (#25). What is written down is left exactly
    // as it was until a Cliente is picked again — it is the Ritiro as it stood
    // a moment ago, offered back under the name it had, which the Operatore
    // reads and can change with the tap they were already making. Forgetting
    // it here instead would throw six scans away for a phone that locked
    // during a search.
    if (cliente === null) {
      return;
    }
    setStorageFailed(
      !writeDraft({
        confirmationPending: pending,
        cliente,
        ceste,
        // Everything taken on this Ritiro, whether it is still on the device or
        // was already lost to an earlier reload: none of it is written down, so
        // all of it has to be taken again.
        notKept: mediaKinds.filter(
          (kind) => captured[kind] !== null || toRetake.includes(kind),
        ),
      }),
    );
  }, [offer, done, cliente, ceste, captured, toRetake, pending]);

  if (done !== null) {
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
          <Button
            className="h-12 text-base"
            onClick={() => {
              setDone(null);
              setCliente(null);
              setCeste([]);
              setCaptured(NOTHING_CAPTURED);
              setToRetake([]);
              setFailed(false);
            }}
          >
            Nuovo Ritiro
          </Button>
          <Button variant="outline" asChild className="h-12 text-base">
            <Link href="/">Torna all&apos;inizio</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Nothing at all for the one frame the device takes to answer. Showing the
  // Cliente search and then pulling it away to ask about a draft would put the
  // Operatore a tap into the wrong Ritiro.
  if (offer === undefined) {
    return null;
  }

  if (offer !== null) {
    return (
      <ResumeOffer
        draft={offer}
        onResume={() => {
          // Back exactly as it was left, and no further: where the app had
          // each Cesta is what it had when she was scanned, and the mutation
          // settles that again on the server and writes the Rettifica by what
          // it finds there (ADR-0005). The signature and the photograph do not
          // come back, and the offer has already said so.
          setCliente(offer.cliente);
          setCeste(offer.ceste);
          setToRetake(offer.notKept);
          setOffer(null);
        }}
        onAbandon={() => {
          // Said no, so it is gone: the next Operatore at this counter is
          // asked nothing and starts on the Cliente in front of them.
          forgetDraft();
          setOffer(null);
        }}
      />
    );
  }

  if (cliente === null) {
    return <ClientePicker onPick={setCliente} pickLabel="Ritiro" />;
  }

  /**
   * What was taken goes up before the Ritiro does, because the Ritiro carries
   * where each of them landed and not the file itself.
   *
   * An upload that fails costs the mill a signature, not a Ritiro. The Ceste
   * are already on the trailer, so the movement is registered without it and
   * the screen says which one is missing: the counter is never blocked, least
   * of all by the optional half of it (ADR-0005, #25).
   */
  const confirm = async () => {
    if (pending || !connected || !navigator.onLine) return;
    setPending(true);
    setFailed(false);
    const notUploaded: MediaKind[] = [];
    const put = async (kind: MediaKind) => {
      const file = captured[kind];
      if (file === null) {
        return undefined;
      }
      try {
        return await upload(await askWhereToPutIt({}), file);
      } catch {
        notUploaded.push(kind);
        return undefined;
      }
    };
    try {
      const signatureId = await put("signature");
      const photoId = await put("photo");
      if (!navigator.onLine) throw new Error("Connessione assente");
      await recordRitiro({
        clienteId: cliente._id,
        cesteIds: ceste.map((cesta) => cesta._id),
        campagnaId,
        signatureId,
        photoId,
      });
      // Registered, so the mill holds it and the device has no business
      // holding it too: a draft left behind here would be offered back as a
      // Ritiro to build, and building it again would send the same Ceste out
      // twice (#24).
      forgetDraft();
      setDone({ cliente, count: ceste.length, notUploaded });
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  // What was taken on this Ritiro before it was resumed and has still not been
  // taken again. One that has been says nothing: it is on the device now, and
  // the Ritiro will carry it.
  const stillToRetake = toRetake.filter((kind) => captured[kind] === null);

  // The Ceste of this Ritiro the app did not have Disponibile, in the order
  // they were added: each of them goes out with a Rettifica beside her.
  const notWhereTheAppHadThem = ceste.filter((cesta) => !asExpected(cesta));

  // What this Cliente is holding already, by numero, and since when the oldest
  // of them has been his. Undefined while the read is still in flight, which
  // is not the same as his holding nothing: the screen says which it is.
  const alreadyOut = held?.cesteFuori;
  const oldestOut = oldestSince(alreadyOut ?? []);

  /**
   * One more Cesta on this Ritiro, however she was read. The camera and the
   * numero field say the same thing about her because they say it from here:
   * scanning `400-R-017` and typing 17 are one act at the counter (#23).
   */
  const addCesta = (cesta: FoundCesta) => {
    // The same Cesta added twice — typed after being scanned, say — is the one
    // Cesta she already was, and saying so is all that is left.
    if (ceste.some((added) => added._id === cesta._id)) {
      return `${cesta.codice} è già nell'elenco.`;
    }
    // Added onto the list as it stands when the Cesta lands on it, not as it
    // stood when this was written: the camera can read two labels in one frame,
    // and a Ritiro that quietly dropped the first of them would be a Ritiro
    // short of a Cesta.
    setCeste((current) =>
      current.some((added) => added._id === cesta._id)
        ? current
        : [...current, cesta],
    );
    // A Cesta the app did not have Disponibile goes out with the Cliente all
    // the same: she is in the yard and he is loading her, and the counter is
    // never blocked (ADR-0005).
    if (asExpected(cesta)) {
      return null;
    }
    // A written-off Cesta is the one case where the movement leaves her where
    // she was: she counts again only once an Admin records the Rettifica of
    // ritrovata on her own page (#20).
    return cesta.state === "dismessa"
      ? `${cesta.codice} risulta Dismessa: la registro lo stesso, ma torna a contare solo con una Rettifica di un Admin.`
      : `${cesta.codice} risulta ${whereTheAppHasHer(cesta)}: la registro lo stesso, con una Rettifica.`;
  };

  return (
    <div className="grid gap-4 pb-4">
      {storageFailed && <DraftStorageError />}
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
            onClick={() => {
              // The Ceste stay: they are in the yard whoever is taking them,
              // and the wrong name was the thing being corrected. The
              // signature does not, because it is one man's hand and no
              // other's — a phone shared across a shift must never confirm
              // one Cliente's signature under the next Cliente's name (#25,
              // and the reason a draft is never restored silently, spec #1).
              setCaptured(NOTHING_CAPTURED);
              setCliente(null);
            }}
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
                onToggle={() =>
                  setCeste(ceste.filter((added) => added._id !== cesta._id))
                }
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
      <RitiroMedia captured={captured} onCapture={setCaptured} />

      <div className="sticky bottom-4 grid gap-3 rounded-xl border bg-card p-3 shadow-lg">
        <CestaReader
          label="Numero della Cesta"
          submitLabel="Aggiungi"
          codici={ceste.map((cesta) => cesta.codice)}
          onCesta={addCesta}
        />
        <Button
          className="h-14 w-full text-lg"
          disabled={!connected || pending || ceste.length === 0 || mustAsk}
          onClick={confirm}
        >
          {pending
            ? "Un attimo…"
            : mustAsk
              ? "Scegli prima la Campagna"
              : `Conferma Ritiro · ${cesteCount(ceste.length)}`}
        </Button>
      </div>
    </div>
  );
}
