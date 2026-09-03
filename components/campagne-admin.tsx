"use client";

import { useMutation, useQuery } from "convex/react";
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
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { comparableName } from "@/convex/schema";
import { dateOf, openOf, type Campagna } from "@/lib/campagna";
import { cesteCount } from "@/lib/ceste";
import { clienteLabel } from "@/lib/cliente";

/** What the Admin is doing to a Campagna, where they are doing anything. */
type Doing =
  | { what: "renaming"; campagnaId: Id<"campagne"> }
  | { what: "closing"; campagnaId: Id<"campagne"> };

/** When a Campagna opened, and when she closed if she has. */
function CampagnaDates({ campagna }: { campagna: Campagna }) {
  return (
    <CardDescription>
      Aperta il {dateOf(campagna.openedAt)}
      {campagna.closedAt !== null && `, chiusa il ${dateOf(campagna.closedAt)}`}
      .
    </CardDescription>
  );
}

/**
 * The box a Campagna is opened or renamed in: one name, and a way back.
 *
 * A name another Campagna already answers to is said so here as it is typed,
 * and refused by the mutation regardless: the counter picks a season by her
 * name, and two of one name is a choice nobody can make.
 */
function NameForm({
  label,
  initial,
  taken,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  label: string;
  initial: string;
  /** The names the other Campagne answer to. */
  taken: string[];
  submitLabel: string;
  onSubmit: (name: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isTaken = taken.some(
    (other) => comparableName(other) === comparableName(name),
  );

  return (
    <form
      className="grid gap-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        setPending(true);
        try {
          await onSubmit(name.trim());
        } catch {
          setError("Non è stato possibile salvare. Riprova.");
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="campagna-name">{label}</Label>
        <Input
          id="campagna-name"
          name="campagna-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="2026"
          className="h-11"
        />
      </div>
      {isTaken && (
        <p role="alert" className="text-sm text-destructive">
          C&rsquo;è già una Campagna con questo nome.
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
        disabled={pending || name.trim() === "" || isTaken}
      >
        {pending ? "Un attimo…" : submitLabel}
      </Button>
      {onCancel !== undefined && (
        <Button
          type="button"
          variant="outline"
          className="h-12 text-base"
          onClick={onCancel}
        >
          Annulla
        </Button>
      )}
    </form>
  );
}

/**
 * What an Admin sees before closing: exactly which Ceste are still out and who
 * holds them. Closing moves none of them — a Cesta at a Cliente's house does
 * not come home because a register was closed — so the list is the whole point
 * of asking (#19).
 */
function ClosingCard({
  campagna,
  onClose,
  onCancel,
}: {
  campagna: Campagna;
  onClose: (confirmed: boolean) => Promise<void>;
  onCancel: () => void;
}) {
  const fuori = useQuery(api.ceste.fuoriByCliente, {});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = async () => {
    setError(null);
    setPending(true);
    try {
      await onClose(true);
    } catch {
      setError("Non è stato possibile chiudere la Campagna. Riprova.");
    } finally {
      setPending(false);
    }
  };

  const outstanding = fuori ?? [];
  const count = outstanding.reduce(
    (total, group) => total + group.ceste.length,
    0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chiudere la Campagna {campagna.name}?</CardTitle>
        <CardDescription>
          {fuori === undefined
            ? "Un attimo…"
            : count === 0
              ? "Nessuna Cesta è Fuori. Chiudere non sposta niente: resta solo un conto chiuso."
              : `Ci sono ancora ${cesteCount(count)} Fuori. Chiudere non le fa rientrare: restano dove sono, con chi le ha.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {outstanding.length > 0 && (
          <ul className="grid gap-2 text-sm">
            {outstanding.map((group) => (
              <li key={group.cliente?._id ?? "nessuno"}>
                <span className="font-semibold">
                  {group.cliente === null
                    ? "Nessun Cliente"
                    : clienteLabel(group.cliente)}
                </span>
                : {group.ceste.map((cesta) => cesta.codice).join(", ")}
              </li>
            ))}
          </ul>
        )}
        {error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          variant="destructive"
          className="h-12 text-base"
          disabled={pending || fuori === undefined}
          onClick={close}
        >
          {pending ? "Un attimo…" : "Chiudi la Campagna"}
        </Button>
        <Button variant="outline" className="h-12 text-base" onClick={onCancel}>
          Annulla
        </Button>
      </CardContent>
    </Card>
  );
}

/**
 * The Campagne, as the Admin who opens and closes them works with them: the
 * season the mill is in, the ones before it, and the four things that can be
 * done to one — opened, renamed, closed and reopened, each of them a row in the
 * Registro (ADR-0006).
 *
 * At most one is open at a time, which the mutations enforce; the screen only
 * stops offering to open a second one.
 */
export function CampagneAdmin() {
  const campagne = useQuery(api.campagne.list, {});
  const openTheCampagna = useMutation(api.campagne.open);
  const renameCampagna = useMutation(api.campagne.rename);
  const closeCampagna = useMutation(api.campagne.close);
  const reopenCampagna = useMutation(api.campagne.reopen);
  const [doing, setDoing] = useState<Doing | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  if (campagne === undefined) {
    return <p className="text-sm text-muted-foreground">Un attimo…</p>;
  }
  const open = openOf(campagne);

  const reopen = async (campagnaId: Id<"campagne">) => {
    setFailed(null);
    try {
      await reopenCampagna({ campagnaId });
    } catch {
      setFailed("Non è stato possibile riaprire la Campagna. Riprova.");
    }
  };

  return (
    <div className="grid gap-6">
      {open === null && (
        <Card>
          <CardHeader>
            <CardTitle>Apri una Campagna</CardTitle>
            <CardDescription>
              Da qui in poi ogni Movimento appartiene a lei.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NameForm
              label="Come si chiama"
              initial=""
              taken={campagne.map((campagna) => campagna.name)}
              submitLabel="Apri la Campagna"
              onSubmit={async (name) => {
                await openTheCampagna({ name });
              }}
            />
          </CardContent>
        </Card>
      )}

      {failed !== null && (
        <p role="alert" className="text-sm text-destructive">
          {failed}
        </p>
      )}

      {campagne.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Il frantoio non ha ancora avuto nessuna Campagna.
        </p>
      ) : (
        <ul className="grid gap-3">
          {campagne.map((campagna) => {
            if (
              doing?.campagnaId === campagna._id &&
              doing.what === "closing"
            ) {
              return (
                <li key={campagna._id}>
                  <ClosingCard
                    campagna={campagna}
                    onClose={async (confirmed) => {
                      await closeCampagna({
                        campagnaId: campagna._id,
                        confirmed,
                      });
                      setDoing(null);
                    }}
                    onCancel={() => setDoing(null)}
                  />
                </li>
              );
            }
            return (
              <li key={campagna._id}>
                <Card>
                  <CardHeader>
                    <CardTitle>{campagna.name}</CardTitle>
                    <CampagnaDates campagna={campagna} />
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {doing?.campagnaId === campagna._id &&
                    doing.what === "renaming" ? (
                      <NameForm
                        label="Come si chiama"
                        initial={campagna.name}
                        // A Campagna is never her own namesake: renaming her
                        // is how a capital letter is put right.
                        taken={campagne
                          .filter((other) => other._id !== campagna._id)
                          .map((other) => other.name)}
                        submitLabel="Salva il nome"
                        onSubmit={async (name) => {
                          await renameCampagna({
                            campagnaId: campagna._id,
                            name,
                          });
                          setDoing(null);
                        }}
                        onCancel={() => setDoing(null)}
                      />
                    ) : (
                      <>
                        {campagna.closedAt === null ? (
                          <Button
                            variant="outline"
                            className="h-12 text-base"
                            onClick={() =>
                              setDoing({
                                what: "closing",
                                campagnaId: campagna._id,
                              })
                            }
                          >
                            Chiudi la Campagna
                          </Button>
                        ) : (
                          open === null && (
                            <Button
                              variant="outline"
                              className="h-12 text-base"
                              onClick={() => reopen(campagna._id)}
                            >
                              Riapri la Campagna
                            </Button>
                          )
                        )}
                        <Button
                          variant="ghost"
                          className="h-12 text-base"
                          onClick={() =>
                            setDoing({
                              what: "renaming",
                              campagnaId: campagna._id,
                            })
                          }
                        >
                          Rinomina
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
