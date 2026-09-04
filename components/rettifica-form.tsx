"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCampagnaChoice } from "@/components/campagna-bar";
import { ClientePicker } from "@/components/cliente-picker";
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
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  rettificaLeaves,
  type AdminRettificaCause,
  type MovimentoKind,
  type State,
} from "@/convex/schema";
import { dayOf, stateInSentence, stateLabel } from "@/lib/ceste";
import { clienteLabel, type Cliente, type ClienteName } from "@/lib/cliente";
import { movimentoLabel } from "@/lib/movimento";
import { timeOf } from "@/lib/registro";

/**
 * The four causes an Admin chooses between, each with what it means and what
 * recording it does to the Cesta — said before the tap, because a Movimento is
 * never undone (ADR-0004) and choosing then confirming is how the mill works.
 */
const CAUSES: {
  cause: AdminRettificaCause;
  title: string;
  says: string;
}[] = [
  {
    cause: "persa",
    title: "Persa",
    says: "Un Cliente non la riporta più. Diventa Dismessa e non conta più fra le Ceste del frantoio.",
  },
  {
    cause: "rotta",
    title: "Rotta",
    says: "Si è rotta al frantoio. Diventa Dismessa e non conta più fra le Ceste del frantoio.",
  },
  {
    cause: "ritrovata",
    title: "Ritrovata",
    says: "È saltata fuori. Torna a contare: al frantoio, o Fuori da chi ce l'ha.",
  },
  {
    cause: "errore",
    title: "Errore di registrazione",
    says: "Un Movimento è stato registrato male. Quello che è scritto resta scritto: qui si dice dov'è davvero la Cesta.",
  },
];

/**
 * Where an Admin can say a Cesta really is. Dismessa is not among them: a Cesta
 * leaves the fleet because she is *persa* or *rotta*, and a Movimento
 * registered wrongly is neither (ADR-0004).
 */
const WHERE_SHE_REALLY_IS: State[] = [
  "disponibile",
  "attesa_molitura",
  "fuori",
];

/** A Movimento of this Cesta as the correction picker lists it. */
type CestaMovimento = {
  _id: Id<"movimenti">;
  kind: MovimentoKind;
  at: number;
  cliente: ClienteName | null;
  operatore: string;
};

/** One line of the picker: which Movimento it was, when, whose, and by whom. */
const movimentoLine = (movimento: CestaMovimento) =>
  [
    `${dayOf(movimento.at)} ${timeOf(movimento.at)}`,
    movimento.cliente === null ? null : clienteLabel(movimento.cliente),
    movimento.operatore,
  ]
    .filter((part) => part !== null)
    .join(" · ");

/**
 * An Admin says what became of a Cesta: lost to a Cliente, broken at the mill,
 * turned up again — and, when she turned up in somebody's hands, whose — or
 * registered wrongly, in which case they say where she really is.
 *
 * This is the only screen that takes a Cesta out of the fleet, and the only one
 * that puts her back into it (spec #1, story 37). The cause is not a formality:
 * losing a Cesta and breaking one are different facts, and the mill counts them
 * apart (ADR-0004).
 */
export function RettificaForm({
  cesta,
  movimenti,
}: {
  cesta: { _id: Id<"ceste">; codice: string };
  /** Her whole history, newest first, out of which a correction picks one. */
  movimenti: CestaMovimento[];
}) {
  const router = useRouter();
  const recordRettifica = useMutation(api.movimenti.rettifica);
  const { campagnaId, mustAsk } = useCampagnaChoice();
  const [chosen, setChosen] = useState<AdminRettificaCause | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [picking, setPicking] = useState(false);
  const [corrects, setCorrects] = useState<Id<"movimenti"> | null>(null);
  const [reallyAt, setReallyAt] = useState<State | null>(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const choice = CAUSES.find((one) => one.cause === chosen);
  // A Rettifica is not corrected: it does not say a Cesta moved, it says where
  // she is (#28).
  const correctable = movimenti.filter(
    (movimento) => movimento.kind !== "rettifica",
  );

  const forget = () => {
    setChosen(null);
    setCliente(null);
    setPicking(false);
    setCorrects(null);
    setReallyAt(null);
    setNote("");
    setFailed(false);
  };

  // A Cesta at the mill is in nobody's hands, so the Cliente goes with the
  // state, and a Cesta really Fuori is Fuori with somebody named.
  const sayWhereSheIs = (state: State) => {
    setReallyAt(state);
    setCliente(null);
    setPicking(state === "fuori");
  };

  if (choice === undefined) {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          Che fine ha fatto questa Cesta?
        </p>
        {CAUSES.map((one) => (
          <Button
            key={one.cause}
            variant="outline"
            className="h-12 text-base"
            onClick={() => setChosen(one.cause)}
          >
            {one.title}
          </Button>
        ))}
      </div>
    );
  }

  if (picking) {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          {choice.cause === "ritrovata"
            ? `Da chi è ricomparsa ${cesta.codice}?`
            : `Da chi è davvero ${cesta.codice}?`}
        </p>
        <ClientePicker
          onPick={(found) => {
            setCliente(found);
            setPicking(false);
          }}
          pickLabel={choice.cause === "ritrovata" ? "Ritrovata da" : "È di"}
        />
        <Button
          variant="ghost"
          className="h-11 text-base"
          onClick={() => setPicking(false)}
        >
          Annulla
        </Button>
      </div>
    );
  }

  // What confirming will do, worked out by the rule the mutation will move her
  // by rather than by a second one written here (CONTEXT.md). An *errore* is
  // the one cause that rule is not asked about: the Admin names the state.
  const settled = choice.cause === "errore" ? null : choice.cause;
  const becomes =
    settled === null ? reallyAt : rettificaLeaves(settled, cliente !== null);

  // What is still missing before the correction can be recorded, in the order
  // the Admin fills it in, so that the button says what to do next rather than
  // going quietly grey.
  const missing =
    settled !== null
      ? null
      : corrects === null
        ? "Scegli il Movimento sbagliato"
        : becomes === null
          ? "Scegli dov'è davvero"
          : becomes === "fuori" && cliente === null
            ? "Scegli il Cliente"
            : null;

  // What confirming will do, once there is enough to say — and what is still
  // missing until there is. A Cesta handed to the wrong Cliente has been Fuori
  // since she left rather than since today, and the wrong Movimento stays
  // exactly as it was written (ADR-0004, #28).
  const where =
    becomes === null
      ? ""
      : stateInSentence(
          becomes,
          cliente === null ? null : clienteLabel(cliente),
        );
  const outcome =
    becomes === null || missing !== null
      ? `${missing ?? "Scegli dov'è davvero"}.`
      : settled === null
        ? `Il Movimento sbagliato resta scritto com'è. ${cesta.codice} risulta ${where}${becomes === "fuori" ? ", dal giorno in cui è uscita" : ""}.`
        : becomes === "fuori" && cliente !== null
          ? `${cesta.codice} risulta ${where}, da oggi.`
          : `${cesta.codice} ${becomes === "dismessa" ? "diventa" : "torna"} ${stateLabel[becomes]}.`;

  const confirm = async () => {
    setPending(true);
    setFailed(false);
    try {
      await recordRettifica({
        cestaId: cesta._id,
        cause: choice.cause,
        clienteId: cliente?._id,
        corrects: corrects ?? undefined,
        becomes: reallyAt ?? undefined,
        // Whatever was typed, blank included: tidying it, and deciding that a
        // blank box is no note at all, is the mutation's.
        note,
        campagnaId,
      });
      forget();
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{choice.title}</CardTitle>
        <CardDescription>{choice.says}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {choice.cause === "ritrovata" && (
          <div className="grid gap-2">
            <p className="text-sm text-muted-foreground">Dov&apos;è adesso?</p>
            <div className="flex gap-3">
              <Button
                variant={cliente === null ? "default" : "outline"}
                className="h-11 flex-1 text-base"
                onClick={() => setCliente(null)}
              >
                Al frantoio
              </Button>
              <Button
                variant={cliente === null ? "outline" : "default"}
                className="h-11 flex-1 text-base"
                onClick={() => setPicking(true)}
              >
                {cliente === null ? "Da un Cliente" : clienteLabel(cliente)}
              </Button>
            </div>
          </div>
        )}

        {choice.cause === "errore" && (
          <>
            <div className="grid gap-2">
              <p className="text-sm text-muted-foreground">
                Quale Movimento è sbagliato?
              </p>
              {correctable.length === 0 ? (
                <p className="text-sm">
                  Su questa Cesta non è ancora stato registrato niente da
                  correggere.
                </p>
              ) : (
                correctable.map((movimento) => (
                  <Button
                    key={movimento._id}
                    variant={corrects === movimento._id ? "default" : "outline"}
                    className="h-auto justify-start py-2 text-left"
                    onClick={() => setCorrects(movimento._id)}
                  >
                    <span className="grid gap-0.5">
                      <span className="font-display text-base font-bold">
                        {movimentoLabel[movimento.kind]}
                      </span>
                      <span className="text-sm font-normal opacity-80">
                        {movimentoLine(movimento)}
                      </span>
                    </span>
                  </Button>
                ))
              )}
            </div>

            <div className="grid gap-2">
              <p className="text-sm text-muted-foreground">
                Dov&apos;è davvero?
              </p>
              <div className="flex gap-3">
                {WHERE_SHE_REALLY_IS.map((state) => (
                  <Button
                    key={state}
                    variant={reallyAt === state ? "default" : "outline"}
                    className="h-11 flex-1 text-sm"
                    onClick={() => sayWhereSheIs(state)}
                  >
                    {stateLabel[state]}
                  </Button>
                ))}
              </div>
              {reallyAt === "fuori" && (
                <Button
                  variant="outline"
                  className="h-11 text-base"
                  onClick={() => setPicking(true)}
                >
                  {cliente === null ? "Da chi?" : clienteLabel(cliente)}
                </Button>
              )}
            </div>
          </>
        )}

        <div className="grid gap-2">
          <Label htmlFor="rettifica-note">Nota (se serve)</Label>
          <Input
            id="rettifica-note"
            name="note"
            type="text"
            autoComplete="off"
            placeholder="Com'è andata"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="h-12 text-base"
          />
        </div>

        <p className="text-sm">{outcome}</p>

        {failed && (
          <p role="alert" className="text-sm text-destructive">
            Non è stato possibile registrare la Rettifica. Controlla la
            connessione e riprova.
          </p>
        )}

        <Button
          variant={
            choice.cause === "persa" || choice.cause === "rotta"
              ? "destructive"
              : "default"
          }
          className="h-12 text-base"
          disabled={pending || mustAsk || missing !== null}
          onClick={confirm}
        >
          {pending
            ? "Un attimo…"
            : mustAsk
              ? "Scegli prima la Campagna"
              : (missing ?? `Conferma la Rettifica · ${choice.title}`)}
        </Button>
        <Button variant="ghost" className="h-11 text-base" onClick={forget}>
          Annulla
        </Button>
      </CardContent>
    </Card>
  );
}
