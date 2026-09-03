"use client";

import { useMutation, useQuery } from "convex/react";
import { HashIcon } from "lucide-react";
import { useState } from "react";
import { useCampagnaChoice } from "@/components/campagna-bar";
import { CestaTile } from "@/components/cesta-tile";
import { NumeroKeypad } from "@/components/numero-keypad";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cesteCount, dayOf, stateLabel, type FoundCesta } from "@/lib/ceste";
import { playConfirmation } from "@/lib/sound";
import { cn } from "@/lib/utils";

/** One Cesta as a tile shows her: her Codice, and nothing else. */
type Tile = { _id: Id<"ceste">; numero: number; codice: string };

/** One Card: whose Ceste these are, since when, and the tiles themselves. */
type Group = {
  key: string;
  title: string;
  alias: string[];
  since: number | null;
  /**
   * What is off about this group, where something is. The keypad says it once
   * as the Cesta goes in, and then the keypad closes over the tiles: the tiles
   * themselves have to keep saying that confirming will write a Rettifica.
   */
  warning: string | null;
  ceste: Tile[];
};

/** The group the keypad puts a Cesta in when the yard has no tile for her. */
const FROM_THE_KEYPAD = "keypad";

/**
 * The Svuotamento: the Ceste standing full in the mill, as big tiles grouped
 * under the Cliente whose name their paper tape carries. Whoever empties them
 * selects a stack and taps once.
 *
 * The mill calls this the hardest moment of the whole flow — dirty hands, no
 * patience for a phone — so everything here is a target big enough to hit
 * without looking: no gesture, no dialog to confirm, nothing that has to be
 * hovered to be found, and the same screen on a phone and on a tablet. Variant
 * B of the prototype the mill chose (#30): one Card per Cliente, 96 px tiles,
 * and the keypad behind one large key beside the confirm button.
 */
export function SvuotamentoScreen() {
  const empty = useMutation(api.movimenti.svuotamento);
  const { campagnaId, mustAsk } = useCampagnaChoice();
  const yard = useQuery(api.ceste.attesaMolituraByCliente);
  const [selected, setSelected] = useState<Id<"ceste">[]>([]);
  // Ceste typed on the keypad that the app does not have in Attesa molitura.
  // They are emptied all the same (ADR-0005), so they need tiles of their own:
  // a selection nobody can see is a selection nobody can undo.
  const [keyed, setKeyed] = useState<FoundCesta[]>([]);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  if (yard === undefined) {
    return <p className="text-muted-foreground">Un attimo…</p>;
  }

  const inTheYard = new Set(
    yard.flatMap((group) => group.ceste.map((cesta) => cesta._id)),
  );
  // A Cesta typed in before her Rientro was registered, and registered since,
  // has a tile in her Cliente's Card now: she does not need a second one.
  const stillUnaccountedFor = keyed
    .filter((cesta) => !inTheYard.has(cesta._id))
    .sort((one, other) => one.numero - other.numero);

  const groups: Group[] = [
    // At the top, because they are the ones somebody had to go looking for.
    ...(stillUnaccountedFor.length === 0
      ? []
      : [
          {
            key: FROM_THE_KEYPAD,
            title: "Aggiunte dal tastierino",
            alias: [],
            since: null,
            warning:
              stillUnaccountedFor.length === 1
                ? "Non risulta in attesa di molitura: si svuota con una Rettifica."
                : "Non risultano in attesa di molitura: si svuotano con una Rettifica.",
            ceste: stillUnaccountedFor,
          },
        ]),
    ...yard.map((group) => ({
      key: group.cliente?._id ?? "nobody",
      title: group.cliente?.name ?? "Senza Cliente",
      alias: group.cliente?.alias ?? [],
      since: group.oldestRientro,
      warning: null,
      ceste: group.ceste,
    })),
  ];

  // What a tap can reach right now. The yard is live, so a Cesta emptied on
  // another device leaves the screen — and leaves the selection and the count
  // on the button with it, because both are read through what is on screen
  // rather than kept beside it.
  const onScreen = new Set(
    groups.flatMap((group) => group.ceste.map((cesta) => cesta._id)),
  );
  const chosen = selected.filter((cestaId) => onScreen.has(cestaId));

  const toggle = (cestaId: Id<"ceste">) =>
    setSelected((current) =>
      current.includes(cestaId)
        ? current.filter((other) => other !== cestaId)
        : [...current, cestaId],
    );

  const wholeGroup = (group: Group) =>
    group.ceste.every((cesta) => chosen.includes(cesta._id));

  const toggleGroup = (group: Group) => {
    const ids = group.ceste.map((cesta) => cesta._id);
    const all = wholeGroup(group);
    setSelected((current) => {
      const others = current.filter((cestaId) => !ids.includes(cestaId));
      return all ? others : [...others, ...ids];
    });
  };

  /** A Cesta the keypad has just found: selected, and given a tile if she needs one. */
  const addByNumero = (cesta: FoundCesta) => {
    if (chosen.includes(cesta._id)) {
      return `${cesta.codice} è già selezionata.`;
    }
    setSelected((current) => [...current, cesta._id]);
    if (!inTheYard.has(cesta._id)) {
      setKeyed((current) =>
        current.some((one) => one._id === cesta._id)
          ? current
          : [...current, cesta],
      );
    }
    return cesta.state === "attesa_molitura"
      ? `${cesta.codice} selezionata.`
      : `${cesta.codice} risulta ${stateLabel[cesta.state]}: verrà svuotata con una Rettifica.`;
  };

  const confirm = async () => {
    setPending(true);
    setFailed(false);
    try {
      await empty({ cesteIds: chosen, campagnaId });
      playConfirmation();
      setSelected([]);
      // What was typed in and has now been emptied leaves with the tiles; what
      // was typed in and then taken off the selection stays where it is.
      setKeyed((current) =>
        current.filter((cesta) => !chosen.includes(cesta._id)),
      );
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      {/* An inset the height of the fixed bar, so that the last row of tiles is
          never underneath it. */}
      <div className="flex flex-col gap-4 pb-[calc(6rem+env(safe-area-inset-bottom))]">
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            Non è stato possibile registrare lo Svuotamento. Controlla la
            connessione e riprova.
          </p>
        )}

        {groups.length === 0 ? (
          <p className="text-muted-foreground">
            Nessuna Cesta in attesa di molitura.
          </p>
        ) : (
          // One column on the phone and two on the tablet, filled left to right
          // and then down, which keeps the longest wait first in reading order.
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {groups.map((group) => {
              const all = wholeGroup(group);
              return (
                <Card key={group.key}>
                  <CardHeader>
                    <button
                      type="button"
                      aria-pressed={all}
                      aria-label={`${all ? "Nessuna" : "Tutte"} · ${group.title}`}
                      onClick={() => toggleGroup(group)}
                      className="flex w-full items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <span className="flex-1 space-y-1">
                        <span className="flex flex-wrap items-center gap-2 font-display text-lg font-bold">
                          {group.title}
                          {group.alias.map((one) => (
                            <Badge key={one} variant="secondary">
                              {one}
                            </Badge>
                          ))}
                        </span>
                        <span className="block text-sm text-muted-foreground">
                          {cesteCount(group.ceste.length)}
                          {group.since !== null &&
                            ` · dal ${dayOf(group.since)}`}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "flex h-12 shrink-0 items-center rounded-md px-4 text-base font-medium",
                          all
                            ? "bg-primary text-primary-foreground"
                            : "border bg-background",
                        )}
                      >
                        {all ? "Nessuna" : "Tutte"}
                      </span>
                    </button>
                    {group.warning !== null && (
                      <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50">
                        {group.warning}
                      </p>
                    )}
                  </CardHeader>
                  {/* Tiles are a fixed 96 px and wrap: three to a row on the
                      phone and five to a row in each of the tablet's two
                      columns, at the sizes the prototype was judged at (#30). A
                      pinned column count would hold those numbers and overflow
                      a narrower tablet instead. */}
                  <CardContent className="flex flex-wrap gap-2">
                    {group.ceste.map((cesta) => (
                      <CestaTile
                        key={cesta._id}
                        codice={cesta.codice}
                        selected={chosen.includes(cesta._id)}
                        onToggle={() => toggle(cesta._id)}
                      />
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 flex items-center gap-3 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="h-16 px-5 text-lg">
              <HashIcon className="size-5" />
              Numero
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aggiungi per numero</DialogTitle>
              <DialogDescription>
                Anche una Cesta che non risulta in attesa di molitura: si svuota
                lo stesso.
              </DialogDescription>
            </DialogHeader>
            <NumeroKeypad onCesta={addByNumero} />
          </DialogContent>
        </Dialog>
        <Button
          className="h-16 flex-1 text-xl"
          disabled={pending || chosen.length === 0 || mustAsk}
          onClick={confirm}
        >
          {pending
            ? "Un attimo…"
            : mustAsk
              ? "Scegli prima la Campagna"
              : `Svuota ${cesteCount(chosen.length)}`}
        </Button>
      </div>
    </>
  );
}
