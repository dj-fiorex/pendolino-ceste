"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
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
import { clienteLabel, type Cliente } from "@/lib/cliente";
import { mediaInSentence, upload } from "@/lib/media";

/**
 * Whether the app had a Cesta where a Ritiro expects to find her: at the mill,
 * empty, ready for the next Cliente. One rule in two voices — the mutation
 * writes the Rettifica of *discrepanza* by it, and this screen writes the
 * warning by it (ADR-0005, #21).
 */
const asExpected = (cesta: FoundCesta) => cesta.state === expectedBefore.ritiro;

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
  const recordRitiro = useMutation(api.movimenti.ritiro);
  const askWhereToPutIt = useMutation(api.media.uploadUrl);
  const { campagnaId, mustAsk } = useCampagnaChoice();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [ceste, setCeste] = useState<FoundCesta[]>([]);
  const [captured, setCaptured] = useState<CapturedMedia>(NOTHING_CAPTURED);
  const [failed, setFailed] = useState(false);
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
  // What this Cliente is already holding, before a single Cesta of this Ritiro
  // is added: the Cliente's own read, the one the Rientro and his page make.
  const held = useQuery(
    api.clienti.get,
    cliente === null ? "skip" : { clienteId: cliente._id },
  );

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
              {`Il Ritiro è registrato, ma ${done.notUploaded
                .map((kind) => mediaInSentence[kind])
                .join(" e ")} ${
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
      await recordRitiro({
        clienteId: cliente._id,
        cesteIds: ceste.map((cesta) => cesta._id),
        campagnaId,
        signatureId,
        photoId,
      });
      setDone({ cliente, count: ceste.length, notUploaded });
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

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
      <Card>
        <CardHeader>
          <CardTitle>{clienteLabel(cliente)}</CardTitle>
          <CardDescription>
            {cliente.phone ?? "Telefono non lo sappiamo"}
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
          disabled={pending || ceste.length === 0 || mustAsk}
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
