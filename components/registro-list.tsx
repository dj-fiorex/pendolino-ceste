"use client";

import { useQuery } from "convex/react";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { MediaKept } from "@/components/media-kept";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { dayBounds } from "@/convex/schema";
import { clienteLabel } from "@/lib/cliente";
import {
  discrepancySentence,
  registroSentence,
  saysItsCampagna,
  timeOf,
} from "@/lib/registro";
import { smsDeliveryLabel, smsWentWrong } from "@/lib/sms";
import { cn } from "@/lib/utils";

/** The option that narrows nothing, and the value the DOM gives it. */
const NARROWS_NOTHING = "";

const selectClass =
  "h-11 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

/**
 * One of the two filters that narrow a day: a Cliente, an Operatore, or
 * everybody. What comes back is the id that went in rather than the string the
 * DOM hands over, so nothing has to be cast back into one.
 */
function FilterSelect<Chosen extends string>({
  id,
  label,
  everybody,
  options,
  chosen,
  onChoose,
}: {
  id: string;
  label: string;
  /** What the first option says, for the day read whole. */
  everybody: string;
  options: { value: Chosen; label: string }[];
  chosen: Chosen | null;
  onChoose: (chosen: Chosen | null) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={id}
        value={chosen ?? NARROWS_NOTHING}
        onChange={(event) =>
          onChoose(
            options.find((option) => option.value === event.target.value)
              ?.value ?? null,
          )
        }
        className={selectClass}
      >
        <option value={NARROWS_NOTHING}>{everybody}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * The Registro of one day: every action taken that day, newest first, as the
 * Italian sentences the mill reads out — "Marco ha registrato un Ritiro di 6
 * Ceste a Giuseppe Amato (Turi): 1, 2, 3…".
 *
 * The day is the filter that is always on, because "what was done on Tuesday"
 * is the question this screen exists to answer; the Cliente and the Operatore
 * narrow it further, and are offered out of the day's own rows so that no
 * choice on offer ever comes back empty.
 */
export function RegistroList({ initialDay }: { initialDay: string }) {
  const [day, setDay] = useState(initialDay);
  const [clienteId, setClienteId] = useState<Id<"clienti"> | null>(null);
  const [operatoreId, setOperatoreId] = useState<Id<"operatori"> | null>(null);
  const [onlyRettifiche, setOnlyRettifiche] = useState(false);

  // A cleared date box is nobody's day: the screen asks for one rather than
  // reading every Campagna the mill has ever had.
  const bounds = day === "" ? null : dayBounds(day);
  const options = useQuery(
    api.registro.filterOptions,
    bounds === null ? "skip" : { day: bounds },
  );
  const rows = useQuery(
    api.registro.list,
    bounds === null
      ? "skip"
      : {
          day: bounds,
          clienteId: clienteId ?? undefined,
          operatoreId: operatoreId ?? undefined,
          producedRettifica: onlyRettifiche ? true : undefined,
        },
  );

  // Another day has its own Clienti and its own Operatori, and a filter left
  // over from the last one would show an empty screen with no reason on it.
  const changeDay = (chosen: string) => {
    setDay(chosen);
    setClienteId(null);
    setOperatoreId(null);
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 rounded-xl border bg-card p-4">
        <div className="grid gap-2">
          <Label htmlFor="registro-day">Il giorno</Label>
          <Input
            id="registro-day"
            name="registro-day"
            type="date"
            value={day}
            onChange={(event) => changeDay(event.target.value)}
            className="h-11"
          />
        </div>

        <FilterSelect
          id="registro-cliente"
          label="Il Cliente"
          everybody="Tutti i Clienti"
          options={(options?.clienti ?? []).map((cliente) => ({
            value: cliente._id,
            label: clienteLabel(cliente),
          }))}
          chosen={clienteId}
          onChoose={setClienteId}
        />

        <FilterSelect
          id="registro-operatore"
          label="L&rsquo;Operatore"
          everybody="Tutti gli Operatori"
          options={(options?.operatori ?? []).map((operatore) => ({
            value: operatore._id,
            label: operatore.name,
          }))}
          chosen={operatoreId}
          onChoose={setOperatoreId}
        />

        <div className="flex min-h-11 items-center justify-between gap-3">
          <div className="grid gap-1">
            <Label htmlFor="registro-rettifiche">Solo rettifiche</Label>
            <p className="text-sm text-muted-foreground">
              Manuali e automatiche
            </p>
          </div>
          <Switch
            id="registro-rettifiche"
            checked={onlyRettifiche}
            onCheckedChange={setOnlyRettifiche}
          />
        </div>
      </div>

      {bounds === null ? (
        <p className="text-sm text-muted-foreground">Scegli un giorno.</p>
      ) : rows === undefined ? (
        <p className="text-sm text-muted-foreground">Un attimo…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Quel giorno non è stato fatto niente.
        </p>
      ) : (
        <ol className="grid gap-2">
          {rows.map((row) => (
            <li
              key={row._id}
              className="flex gap-3 rounded-lg border bg-card px-4 py-3"
            >
              <span className="font-display font-bold tabular-nums text-muted-foreground">
                {timeOf(row.at)}
              </span>
              <div className="flex-1">
                <p>
                  {registroSentence(row)}
                  {/* The Campagna the action belonged to, where the sentence
                      has not already said it (#19). */}
                  {saysItsCampagna(row) && (
                    <span className="text-muted-foreground">
                      {" "}
                      · Campagna {row.campagna}
                    </span>
                  )}
                </p>
                {row.discrepanze.length > 0 && (
                  <Alert variant="warning" className="mt-3">
                    <TriangleAlert aria-hidden="true" />
                    <AlertTitle>Rettifiche automatiche</AlertTitle>
                    <AlertDescription>
                      <ul className="grid gap-1">
                        {row.discrepanze.map((discrepancy) => (
                          <li key={discrepancy.numero}>
                            {discrepancySentence(discrepancy)}
                          </li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                {/* What the Cliente left at the counter, on the one line that
                    is the whole Ritiro rather than one of its six Ceste
                    (ADR-0006, #25). */}
                <MediaKept media={row.media} />
                {/* Whether this action got its message out. Said here and not
                    at the counter: an Operatore registering a Ritiro has a
                    queue in front of them, and an Sms is nothing they can act
                    on (ADR-0005). */}
                {row.sms !== null && (
                  <p
                    className={cn(
                      "text-sm text-muted-foreground",
                      smsWentWrong(row.sms.delivery) &&
                        "font-semibold text-amber-700 dark:text-amber-300",
                    )}
                  >
                    SMS · {smsDeliveryLabel(row.sms.delivery)}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
