"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { EmailDelivery, Role } from "@/convex/schema";
import { dateOf } from "@/lib/campagna";
import { roleLabel } from "@/lib/operatore";

/** One of the mill's people, as the staff screen reads them. */
type StaffMember = {
  _id: Id<"operatori">;
  name: string;
  email: string;
  role: Role;
  active: boolean;
};

/** What the Admin is in the middle of, where they are in the middle of one. */
type Doing = { what: "deactivating"; operatoreId: Id<"operatori"> };

/**
 * The box a new Operatore is invited from. The Admin writes down who they are
 * and where to reach them; the password is never here, because nobody at this
 * mill types one somebody else chose (#26).
 */
function InviteForm({
  onInvite,
}: {
  onInvite: (person: {
    name: string;
    email: string;
    role: Role;
  }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [asAdmin, setAsAdmin] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setError(null);
        setPending(true);
        try {
          await onInvite({
            name: name.trim(),
            email: email.trim(),
            role: asAdmin ? "admin" : "operatore",
          });
          setName("");
          setEmail("");
          setAsAdmin(false);
        } catch {
          setError(
            "Non è stato possibile mandare l'invito. Controlla l'email e riprova.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="operatore-name">Come si chiama</Label>
        <Input
          id="operatore-name"
          name="operatore-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nadia Greco"
          className="h-11"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="operatore-email">La sua email</Label>
        <Input
          id="operatore-email"
          name="operatore-email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="nadia@frantoio.it"
          className="h-11"
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <Label htmlFor="operatore-admin" className="font-normal">
          Può fare anche l&rsquo;Admin
        </Label>
        <Switch
          id="operatore-admin"
          checked={asAdmin}
          onCheckedChange={setAsAdmin}
        />
      </div>
      {error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="h-12 text-base"
        disabled={pending || name.trim() === "" || !email.includes("@")}
      >
        {pending ? "Un attimo…" : "Manda l'invito"}
      </Button>
    </form>
  );
}

/** What became of the email carrying an invitation, in one line. */
function Delivery({ delivery }: { delivery: EmailDelivery }) {
  if (delivery === null) {
    return <span className="text-muted-foreground">In partenza…</span>;
  }
  if (delivery.kind === "sent") {
    return <span className="text-muted-foreground">Mandato per email.</span>;
  }
  return (
    <span className="text-destructive">
      L&rsquo;email non è partita: {delivery.reason}
    </span>
  );
}

/**
 * The mill's staff, as the Admin who invites and deactivates them works with
 * them: who is at the counter, who has been asked and has not arrived yet, and
 * the four things that can be done to a person — invited, promoted, sent a new
 * password, and taken off the counter, each of them a row in the Registro
 * (ADR-0006).
 *
 * Nobody is ever removed from this list. A deactivated Operatore stays here
 * with everything they registered still under their name (ADR-0004).
 */
export function OperatoriAdmin({ yourEmail }: { yourEmail: string }) {
  const staff = useQuery(api.operatori.list, {});
  const waiting = useQuery(api.accessLinks.pending, {});
  const inviteOperatore = useMutation(api.operatori.invite);
  const promoteOperatore = useMutation(api.operatori.promote);
  const deactivateOperatore = useMutation(api.operatori.deactivate);
  const sendPasswordReset = useMutation(api.operatori.sendPasswordReset);
  const [doing, setDoing] = useState<Doing | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);

  if (staff === undefined) {
    return <p className="text-sm text-muted-foreground">Un attimo…</p>;
  }

  /** Runs one of the four, and says so or says why not. */
  const act = async (what: () => Promise<unknown>, done: string) => {
    setFailed(null);
    setSaid(null);
    try {
      await what();
      setSaid(done);
    } catch {
      setFailed("Non è stato possibile. Riprova.");
    }
  };

  const Actions = ({ operatore }: { operatore: StaffMember }) => (
    <CardContent className="grid gap-3">
      {operatore.role === "operatore" && (
        <Button
          variant="outline"
          className="h-12 text-base"
          onClick={() =>
            act(
              () => promoteOperatore({ operatoreId: operatore._id }),
              `${operatore.name} adesso è Admin.`,
            )
          }
        >
          Promuovi a Admin
        </Button>
      )}
      <Button
        variant="outline"
        className="h-12 text-base"
        onClick={() =>
          act(
            () => sendPasswordReset({ operatoreId: operatore._id }),
            `Mandato a ${operatore.name} il link per la password.`,
          )
        }
      >
        Manda il link per la password
      </Button>
      {operatore.email !== yourEmail && (
        <Button
          variant="ghost"
          className="h-12 text-base"
          onClick={() =>
            setDoing({ what: "deactivating", operatoreId: operatore._id })
          }
        >
          Disattiva
        </Button>
      )}
    </CardContent>
  );

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Invita una persona</CardTitle>
          <CardDescription>
            Le arriva un&rsquo;email con un link: la password se la sceglie lei.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteForm
            onInvite={async (person) => {
              await inviteOperatore(person);
              setFailed(null);
              setSaid(`Invito mandato a ${person.name}.`);
            }}
          />
        </CardContent>
      </Card>

      {said !== null && <p className="text-sm text-muted-foreground">{said}</p>}
      {failed !== null && (
        <p role="alert" className="text-sm text-destructive">
          {failed}
        </p>
      )}

      <ul className="grid gap-3">
        {staff.map((operatore) => (
          <li key={operatore._id}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {operatore.name}
                  <Badge
                    variant={operatore.role === "admin" ? "default" : "outline"}
                  >
                    {roleLabel[operatore.role]}
                  </Badge>
                  {!operatore.active && (
                    <Badge variant="secondary">Non più al banco</Badge>
                  )}
                </CardTitle>
                <CardDescription>{operatore.email}</CardDescription>
              </CardHeader>
              {doing?.operatoreId === operatore._id ? (
                <CardContent className="grid gap-3">
                  <p className="text-sm">
                    Disattivare {operatore.name}? Non potrà più entrare. Quello
                    che ha registrato resta dov&rsquo;è, con il suo nome.
                  </p>
                  <Button
                    variant="destructive"
                    className="h-12 text-base"
                    onClick={async () => {
                      await act(
                        () =>
                          deactivateOperatore({ operatoreId: operatore._id }),
                        `${operatore.name} non entra più.`,
                      );
                      setDoing(null);
                    }}
                  >
                    Disattiva {operatore.name}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 text-base"
                    onClick={() => setDoing(null)}
                  >
                    Annulla
                  </Button>
                </CardContent>
              ) : (
                operatore.active && <Actions operatore={operatore} />
              )}
            </Card>
          </li>
        ))}
      </ul>

      {waiting !== undefined && waiting.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Inviti in attesa</CardTitle>
            <CardDescription>
              Mandati, e non ancora accettati. Se uno scade, mandane un altro.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 text-sm">
              {waiting.map((invitation) => (
                <li key={invitation._id} className="grid gap-1">
                  <span className="font-semibold">
                    {invitation.name} — {roleLabel[invitation.role]}
                  </span>
                  <span className="text-muted-foreground">
                    {invitation.email}, scade il {dateOf(invitation.expiresAt)}.
                  </span>
                  <Delivery delivery={invitation.delivery} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
