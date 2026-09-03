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
import { rettificaLeaves, type AdminRettificaCause } from "@/convex/schema";
import { stateLabel } from "@/lib/ceste";
import { clienteLabel, type Cliente } from "@/lib/cliente";

/**
 * The three causes an Admin chooses between, each with what it means and what
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
];

/**
 * An Admin says what became of a Cesta: lost to a Cliente, broken at the mill,
 * or turned up again — and, when she turned up in somebody's hands, whose.
 *
 * This is the only screen that takes a Cesta out of the fleet, and the only one
 * that puts her back into it (spec #1, story 37). The cause is not a formality:
 * losing a Cesta and breaking one are different facts, and the mill counts them
 * apart (ADR-0004).
 */
export function RettificaForm({
  cesta,
}: {
  cesta: { _id: Id<"ceste">; codice: string };
}) {
  const router = useRouter();
  const recordRettifica = useMutation(api.movimenti.rettifica);
  const { campagnaId, mustAsk } = useCampagnaChoice();
  const [chosen, setChosen] = useState<AdminRettificaCause | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [picking, setPicking] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const choice = CAUSES.find((one) => one.cause === chosen);

  const forget = () => {
    setChosen(null);
    setCliente(null);
    setPicking(false);
    setNote("");
    setFailed(false);
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
          Da chi è ricomparsa {cesta.codice}?
        </p>
        <ClientePicker
          onPick={(found) => {
            setCliente(found);
            setPicking(false);
          }}
          pickLabel="Ritrovata da"
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
  // by rather than by a second one written here (CONTEXT.md).
  const becomes = rettificaLeaves(choice.cause, cliente !== null);
  const outcome =
    becomes === "fuori" && cliente !== null
      ? `${cesta.codice} risulta Fuori con ${clienteLabel(cliente)}, da oggi.`
      : `${cesta.codice} ${becomes === "dismessa" ? "diventa" : "torna"} ${stateLabel[becomes]}.`;

  const confirm = async () => {
    setPending(true);
    setFailed(false);
    try {
      await recordRettifica({
        cestaId: cesta._id,
        cause: choice.cause,
        clienteId: cliente?._id,
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
          variant={choice.cause === "ritrovata" ? "default" : "destructive"}
          className="h-12 text-base"
          disabled={pending || mustAsk}
          onClick={confirm}
        >
          {pending
            ? "Un attimo…"
            : mustAsk
              ? "Scegli prima la Campagna"
              : `Conferma la Rettifica · ${choice.title}`}
        </Button>
        <Button variant="ghost" className="h-11 text-base" onClick={forget}>
          Annulla
        </Button>
      </CardContent>
    </Card>
  );
}
