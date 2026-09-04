"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { useCampagnaChoice } from "@/components/campagna-bar";
import { CestaReader } from "@/components/cesta-reader";
import { CestaTile } from "@/components/cesta-tile";
import { ClientePicker } from "@/components/cliente-picker";
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
import type { Id } from "@/convex/_generated/dataModel";
import {
  cesteCount,
  dayOf,
  daysSince,
  warningLine,
  type FoundCesta,
} from "@/lib/ceste";
import { clienteLabel, type Cliente } from "@/lib/cliente";

/** A Cesta on the trailer, whether or not the app believed she was his. */
type OnTheTrailer = { _id: Id<"ceste">; numero: number; codice: string };

/**
 * The Rientro: nobody is searched for. The Operatore reads the numero off any
 * one Cesta of the load and the app says whose it is; then the Ceste that
 * Cliente is holding come up as tiles and the ones on the trailer are ticked.
 *
 * Variant B of the prototype the mill chose (#31): ticking what came back,
 * rather than filling an empty list, is what makes a partial return visible —
 * the two that stayed on the farm are named on the screen instead of being
 * merely absent from it, and they stay Fuori and stay counted against him.
 */
export function RientroFlow() {
  const recordRientro = useMutation(api.movimenti.rientro);
  const { campagnaId, mustAsk } = useCampagnaChoice();
  // The one Cesta the load was identified by: whose the app says it is before
  // the Cliente is settled, and the Cesta the tiles are opened with after.
  const [identifiedBy, setIdentifiedBy] = useState<FoundCesta | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  // The Cliente is being looked up rather than read off a Cesta: either the
  // app had nobody to name, or the Operatore said it is somebody else.
  const [searching, setSearching] = useState(false);
  const [ticked, setTicked] = useState<Id<"ceste">[]>([]);
  // Ceste typed on the trailer that the app does not believe are his. They
  // come back with him anyway (ADR-0005), so they belong on the screen — and
  // they are kept whole, because the warning has to say where the app did have
  // them and with whom (#21).
  const [alsoHere, setAlsoHere] = useState<FoundCesta[]>([]);
  const [done, setDone] = useState<{ cliente: Cliente; count: number } | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);

  const held = useQuery(
    api.clienti.get,
    cliente === null ? "skip" : { clienteId: cliente._id },
  );

  const startOver = () => {
    setDone(null);
    setIdentifiedBy(null);
    setCliente(null);
    setSearching(false);
    setTicked([]);
    setAlsoHere([]);
    setFailed(false);
  };

  /** The load is settled on a Cliente, and the Cesta it was found by opens it. */
  const openLoadFor = (whoIsHere: Cliente) => {
    setCliente(whoIsHere);
    setSearching(false);
    if (identifiedBy === null) {
      return;
    }
    // She was scanned off the trailer, so she is on it whatever the app
    // believed; if the app did not have her as his, she needs a tile of her own.
    setTicked([identifiedBy._id]);
    setAlsoHere(
      identifiedBy.cliente?._id === whoIsHere._id ? [] : [identifiedBy],
    );
  };

  const toggle = (cestaId: Id<"ceste">) =>
    setTicked((current) =>
      current.includes(cestaId)
        ? current.filter((other) => other !== cestaId)
        : [...current, cestaId],
    );

  if (done !== null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rientro registrato</CardTitle>
          <CardDescription>
            {cesteCount(done.count)} da {clienteLabel(done.cliente)}, in attesa
            di molitura.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button className="h-12 text-base" onClick={startOver}>
            Nuovo Rientro
          </Button>
          <Button variant="outline" asChild className="h-12 text-base">
            <Link href="/attesa-molitura">Vedi l&apos;Attesa molitura</Link>
          </Button>
          <Button variant="outline" asChild className="h-12 text-base">
            <Link href="/">Torna all&apos;inizio</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // The load is open and its Cliente is being changed: what is already ticked
  // stays ticked, since it is the name that was wrong and not the trailer.
  if (cliente !== null && searching) {
    return (
      <ClientePicker
        pickLabel="Rientro"
        onPick={(picked) => {
          setCliente(picked);
          setSearching(false);
        }}
      />
    );
  }

  if (cliente !== null) {
    if (held === undefined) {
      return <p className="text-muted-foreground">Un attimo…</p>;
    }

    const fuori = held?.cesteFuori ?? [];
    const onTheTrailer: OnTheTrailer[] = [...fuori, ...alsoHere];
    const oldest = fuori
      .map((cesta) => cesta.since)
      .filter((since) => since !== null)
      .sort((one, other) => one - other)[0];
    const stayingOut = fuori.filter((cesta) => !ticked.includes(cesta._id));
    // The Ceste on the trailer that the app does not have Fuori with the man
    // driving it — never went out, or went out with somebody else. Read against
    // the load as it stands now, so that changing the Cliente mid-Rientro
    // changes who is a surprise and who is not.
    const notWhereTheAppHadThem = alsoHere.filter(
      (cesta) =>
        ticked.includes(cesta._id) &&
        !fuori.some((his) => his._id === cesta._id),
    );

    /**
     * One more Cesta off the trailer, however she was read. The camera and the
     * numero field say the same thing about her because they say it from here:
     * scanning `400-R-017` and typing 17 are one act at the counter (#23).
     */
    const addCesta = (cesta: FoundCesta) => {
      const his = fuori.some((one) => one._id === cesta._id);
      // Both lists are added to as they stand when the Cesta lands on them, not
      // as they stood when this was written: the camera can read two labels in
      // one frame, and a Rientro that quietly dropped the first of them would
      // leave a Cesta Fuori that is standing in the yard.
      if (!his) {
        setAlsoHere((current) =>
          current.some((one) => one._id === cesta._id)
            ? current
            : [...current, cesta],
        );
      }
      if (ticked.includes(cesta._id)) {
        return `${cesta.codice} è già spuntata.`;
      }
      setTicked((current) =>
        current.includes(cesta._id) ? current : [...current, cesta._id],
      );
      // The app not having her out with the man driving her back is the same
      // size of surprise whether it had her at the mill or with somebody else:
      // either way it was wrong about whose she was, and she comes back all
      // the same (ADR-0005).
      return his
        ? null
        : `${warningLine(cesta)}: rientra lo stesso, con una Rettifica.`;
    };

    const confirm = async () => {
      setPending(true);
      setFailed(false);
      try {
        await recordRientro({
          clienteId: cliente._id,
          cesteIds: ticked,
          campagnaId,
        });
        setDone({ cliente, count: ticked.length });
      } catch {
        setFailed(true);
      } finally {
        setPending(false);
      }
    };

    return (
      <div className="grid gap-4 pb-4">
        <Card>
          <CardHeader>
            <CardTitle>Ceste di {clienteLabel(cliente)}</CardTitle>
            <CardDescription>
              {fuori.length === 0
                ? "Non risulta avere Ceste Fuori."
                : `${cesteCount(fuori.length)} Fuori${oldest === undefined ? "" : ` dal ${dayOf(oldest)} · ${daysSince(oldest)}`}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {identifiedBy !== null && (
              <p className="justify-self-start rounded-full bg-secondary px-3 py-1 font-display text-sm font-semibold text-secondary-foreground tabular-nums">
                Letta {identifiedBy.codice}
              </p>
            )}
            <Button
              variant="outline"
              className="h-11 w-full text-base"
              onClick={() => setSearching(true)}
            >
              Cambia Cliente
            </Button>
          </CardContent>
        </Card>

        <div className="flex items-baseline justify-between text-sm text-muted-foreground">
          <span>Sul rimorchio · tocca per spuntare</span>
          <span>{cesteCount(ticked.length)}</span>
        </div>

        {onTheTrailer.length === 0 ? (
          <p className="text-muted-foreground">
            Ancora nessuna Cesta sul rimorchio.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {onTheTrailer.map((cesta) => (
              <li key={cesta._id}>
                <CestaTile
                  codice={cesta.codice}
                  selected={ticked.includes(cesta._id)}
                  onToggle={() => toggle(cesta._id)}
                />
              </li>
            ))}
          </ul>
        )}

        {stayingOut.length > 0 && (
          <Warning>
            <span className="font-semibold">
              {stayingOut.length === 1 ? "Resta" : "Restano"} Fuori con{" "}
              {cliente.name}:
            </span>{" "}
            <span className="font-display tabular-nums">
              {stayingOut.map((cesta) => cesta.codice).join(" · ")}
            </span>
          </Warning>
        )}

        {/* Said once as each Cesta is ticked, and then again here until the
            Rientro is confirmed: the tiles scroll and the warning must not
            scroll away with them. It gates nothing — the load is on the
            weighbridge either way (ADR-0005). */}
        {notWhereTheAppHadThem.length > 0 && (
          <Warning>
            <span className="font-semibold">
              {notWhereTheAppHadThem.length === 1
                ? "Rientra lo stesso, con una Rettifica:"
                : "Rientrano lo stesso, con una Rettifica per ognuna:"}
            </span>{" "}
            {notWhereTheAppHadThem.map(warningLine).join(" · ")}.
          </Warning>
        )}

        {failed && (
          <p role="alert" className="text-sm text-destructive">
            Non è stato possibile registrare il Rientro. Controlla la
            connessione e riprova.
          </p>
        )}

        <div className="sticky bottom-4 grid gap-3 rounded-xl border bg-card p-3 shadow-lg">
          <CestaReader
            label="Numero della Cesta"
            submitLabel="Aggiungi"
            codici={onTheTrailer
              .filter((cesta) => ticked.includes(cesta._id))
              .map((cesta) => cesta.codice)}
            onCesta={addCesta}
          />
          <Button
            className="h-14 w-full text-lg"
            disabled={pending || ticked.length === 0 || mustAsk}
            onClick={confirm}
          >
            {pending
              ? "Un attimo…"
              : mustAsk
                ? "Scegli prima la Campagna"
                : `Registra Rientro · ${cesteCount(ticked.length)}`}
          </Button>
        </div>
      </div>
    );
  }

  // The Cesta names a Cliente: the Operatore reads the name off the screen,
  // looks at whoever is at the counter, and says yes or looks them up instead.
  if (identifiedBy !== null && identifiedBy.cliente !== null && !searching) {
    const holder = identifiedBy.cliente;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-display tabular-nums">
            {identifiedBy.codice}
          </CardTitle>
          <CardDescription>
            Questa Cesta risulta a {clienteLabel(holder)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Button
            className="h-12 text-base"
            onClick={() => openLoadFor(holder)}
          >
            Rientro di {clienteLabel(holder)}
          </Button>
          <Button
            variant="outline"
            className="h-12 text-base"
            onClick={() => setSearching(true)}
          >
            È un altro Cliente
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Nobody to read off the Cesta, so the Cliente is searched for as at a Ritiro
  // (#16). What the app believed instead is #21's to record.
  if (identifiedBy !== null) {
    return (
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-display tabular-nums">
              {identifiedBy.codice}
            </CardTitle>
            <CardDescription>
              {identifiedBy.cliente === null
                ? "L'app non sa di chi sia questa Cesta. Cerca chi la sta riportando."
                : "Cerca chi sta riportando le Ceste."}
            </CardDescription>
          </CardHeader>
        </Card>
        <ClientePicker pickLabel="Rientro" onPick={openLoadFor} />
      </div>
    );
  }

  // The load is not open yet, so the camera has nothing to hand over twice:
  // the first Cesta it reads is the one that names the Cliente, and this
  // screen gives way to his.
  const identify = (cesta: FoundCesta) => {
    setIdentifiedBy(cesta);
    return null;
  };

  return (
    <div className="grid gap-4">
      <CestaReader
        label="Numero di una Cesta del carico"
        submitLabel="Cerca"
        codici={[]}
        onCesta={identify}
      />
      <p className="text-muted-foreground">
        Basta una Cesta qualsiasi del carico: l&apos;app dice di chi è, e il
        resto si spunta dopo.
      </p>
    </div>
  );
}
