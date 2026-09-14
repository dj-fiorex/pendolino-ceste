"use client";

import { useQuery } from "convex/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  nameCampagna,
  namedCampagna,
  noNamedCampagna,
  openOf,
  subscribeToNamedCampagna,
  type Campagna,
} from "@/lib/campagna";

/**
 * The Campagna what this device registers belongs to: the one the mill has
 * open, or, when it has none, the one the Operatore named here.
 *
 * The mutations settle this again on the server — the open Campagna wins
 * whatever a device still remembers — so this is what the screen shows and
 * what it sends, not the last word on either.
 */
function useCampagna(campagne: Campagna[] | undefined): {
  campagne: Campagna[] | undefined;
  open: Campagna | null;
  named: Campagna | null;
} {
  const namedId = useSyncExternalStore(
    subscribeToNamedCampagna,
    namedCampagna,
    noNamedCampagna,
  );
  const open = campagne === undefined ? null : openOf(campagne);

  // A choice made while the mill had nothing open lasts until it opens one, and
  // no longer: the season the mill is in is then the answer, and the next time
  // it has none the Operatore is asked again rather than inheriting a Campagna
  // they named a year ago (#19).
  useEffect(() => {
    if (open !== null && namedId !== null) {
      nameCampagna(null);
    }
  }, [open, namedId]);

  if (campagne === undefined) {
    return { campagne, open: null, named: null };
  }
  return {
    campagne,
    open,
    named: campagne.find((campagna) => campagna._id === namedId) ?? null,
  };
}

/**
 * What a screen recording a Movimento needs to know about the Campagna: the
 * one to send, and whether the Operatore has still to say which it is.
 *
 * The Campagna is the open one, or the one this device names while the mill
 * has none open. A mill with no Campagna at all is asked nothing and records
 * all the same: the counter is never blocked by the calendar (ADR-0005), and
 * only an Admin can open one.
 */
export function useCampagnaChoice(): {
  campagnaId: Id<"campagne"> | undefined;
  mustAsk: boolean;
} {
  const campagne = useQuery(api.campagne.list, {});
  const { open, named } = useCampagna(campagne);
  return {
    campagnaId: (open ?? named)?._id,
    mustAsk:
      campagne !== undefined &&
      campagne.length > 0 &&
      open === null &&
      named === null,
  };
}

/** One Campagna to tap, as the picker offers her. */
function CampagnaChoice({
  campagna,
  onPick,
}: {
  campagna: Campagna;
  onPick: () => void;
}) {
  return (
    <Button
      variant="outline"
      className="h-11 w-full justify-start text-base"
      onClick={onPick}
    >
      {campagna.name}
    </Button>
  );
}

/**
 * The header that says which Campagna what is registered here belongs to.
 *
 * While one is open it only says so. While none is, it asks the Operatore
 * once which existing Campagna their Movimenti belong to, remembers the answer
 * on this device and lets a tap change it — the counter goes on either way,
 * because opening a Campagna is an Admin's and the queue is not (ADR-0005).
 * Picking a closed Campagna does not reopen it.
 */
export function CampagnaBar({
  campagne,
}: {
  campagne: Campagna[] | undefined;
}) {
  const { open, named } = useCampagna(campagne);
  const [choosing, setChoosing] = useState(false);

  if (campagne === undefined) {
    return null;
  }

  if (open !== null) {
    return (
      <p className="rounded-lg border bg-card px-4 py-2 text-sm">
        <span className="text-muted-foreground">Campagna aperta: </span>
        <span className="font-semibold">{open.name}</span>
      </p>
    );
  }

  if (campagne.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-2 text-sm text-muted-foreground">
        Nessuna Campagna: chiedi a un Admin di aprirne una. Quello che registri
        adesso resta registrato.
      </p>
    );
  }

  if (named === null || choosing) {
    return (
      <div className="grid gap-3 rounded-lg border bg-card p-4">
        <p className="text-sm">
          Nessuna Campagna è aperta. A quale appartiene quello che registri qui?
        </p>
        {campagne.map((campagna) => (
          <CampagnaChoice
            key={campagna._id}
            campagna={campagna}
            onPick={() => {
              nameCampagna(campagna._id);
              setChoosing(false);
            }}
          />
        ))}
        {named !== null && (
          <Button
            variant="ghost"
            className="h-11 text-base"
            onClick={() => setChoosing(false)}
          >
            Annulla
          </Button>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setChoosing(true)}
      className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-2 text-left text-sm"
    >
      <span>
        <span className="text-muted-foreground">Registri nella Campagna </span>
        <span className="font-semibold">{named.name}</span>
      </span>
      <span className="text-muted-foreground underline underline-offset-4">
        Cambia
      </span>
    </button>
  );
}
