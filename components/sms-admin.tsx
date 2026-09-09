"use client";

import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { phoneInNational } from "@/convex/phone";
import type { FrantoioSettings } from "@/convex/schema";
import {
  PLACEHOLDERS,
  cesteInWords,
  renderTemplate,
  segmentsOf,
  tidyForSms,
  unknownPlaceholders,
  type SmsValues,
} from "@/convex/template";
import { clienteLabel } from "@/lib/cliente";
import {
  smsDeliveryLabel,
  smsKindLabel,
  smsWentWrong,
  smsWhen,
} from "@/lib/sms";
import { cn } from "@/lib/utils";

const textareaClass =
  "min-h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

const selectClass =
  "h-11 w-full rounded-md border border-input bg-transparent px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

/**
 * The Cliente the preview is written about: made up, and the same one every
 * time, so that an Admin comparing two drafts is comparing the words.
 */
const SAMPLE = { nome: "Giuseppe Amato", numeri: "17, 22, 34" };

/**
 * The two cases an Admin would otherwise never think to check: a Cliente who
 * moved one Cesta, and a Rientro that leaves him with none. Both come out
 * grammatical because the number travels with its noun, and the preview is
 * where that is proved rather than promised.
 */
type PreviewCase = "sei" | "una" | "zero";

const previewValues = (
  which: PreviewCase,
  mill: FrantoioSettings,
): SmsValues => ({
  nome: SAMPLE.nome,
  ceste: cesteInWords(which === "sei" ? 6 : 1),
  totale: cesteInWords(which === "zero" ? 0 : which === "sei" ? 6 : 1),
  numeri: which === "sei" ? SAMPLE.numeri : "17",
  frantoio: mill.millName,
  telefono: mill.millPhone,
});

/** One message: whether it goes out, what it says, and how it reads. */
function TemplateEditor({
  id,
  title,
  description,
  template,
  on,
  onTemplate,
  onSwitch,
  mill,
}: {
  id: string;
  title: string;
  description: string;
  template: string;
  on: boolean;
  onTemplate: (template: string) => void;
  onSwitch: (on: boolean) => void;
  mill: FrantoioSettings;
}) {
  const [which, setWhich] = useState<PreviewCase>("sei");
  const noSender = mill.smsSender === "";
  const unknown = unknownPlaceholders(template);
  const preview = renderTemplate(
    tidyForSms(template),
    previewValues(which, mill),
  );
  const { characters, segments, unicode } = segmentsOf(preview);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={`${id}-on`}>Mandalo</Label>
            <Switch
              id={`${id}-on`}
              checked={on}
              disabled={noSender}
              onCheckedChange={onSwitch}
            />
          </div>
          {noSender && (
            <p className="text-sm text-muted-foreground">
              Prima serve un mittente: si sceglie in{" "}
              <Link
                href="/frantoio"
                className="underline underline-offset-4 hover:text-foreground"
              >
                «Il frantoio»
              </Link>
              .
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${id}-testo`}>Modello di SMS</Label>
          <textarea
            id={`${id}-testo`}
            className={textareaClass}
            value={template}
            onChange={(event) => onTemplate(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            Puoi usare {PLACEHOLDERS.map((name) => `{{${name}}}`).join(", ")}.
          </p>
          {unknown.length > 0 && (
            <p role="alert" className="text-sm text-destructive">
              Non so cosa scrivere al posto di{" "}
              {unknown.map((name) => `{{${name}}}`).join(", ")}.
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${id}-prova`}>Come si legge</Label>
          <select
            id={`${id}-prova`}
            className={selectClass}
            value={which}
            onChange={(event) => setWhich(event.target.value as PreviewCase)}
          >
            <option value="sei">Con sei Ceste</option>
            <option value="una">Con una Cesta sola</option>
            <option value="zero">Quando non gliene restano</option>
          </select>
          <div className="rounded-lg border bg-secondary text-secondary-foreground">
            <p className="border-b px-3 py-2 text-sm text-muted-foreground">
              Da:{" "}
              {noSender ? (
                <span className="italic">mittente non ancora scelto</span>
              ) : (
                <span className="font-medium text-secondary-foreground">
                  {mill.smsSender}
                </span>
              )}
            </p>
            <p className="p-3 text-base whitespace-pre-wrap">{preview}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            {characters} caratteri ·{" "}
            {segments === 1 ? "1 SMS" : `${segments} SMS`}
            {unicode && (
              <span className="text-amber-700 dark:text-amber-300">
                {" "}
                · c&rsquo;è un carattere speciale: ogni SMS conta 70 caratteri
                invece di 160.
              </span>
            )}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Everything the mill has sent this Campagna, and what it has cost in SMS. */
function SmsList() {
  const campagne = useQuery(api.campagne.list, {});
  const [chosen, setChosen] = useState<Id<"campagne"> | null | undefined>(
    undefined,
  );
  // Until the Admin picks, the season the mill is in: the list is read on a
  // morning to answer "sta funzionando", and that is this Campagna's question.
  const openCampagna = (campagne ?? []).find(
    (campagna) => campagna.closedAt === null,
  );
  const campagnaId =
    chosen === undefined ? openCampagna?._id : (chosen ?? undefined);
  const sent = useQuery(api.sms.list, { campagnaId });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gli SMS mandati</CardTitle>
        <CardDescription>
          {sent === undefined
            ? "Un attimo…"
            : `${sent.count === 1 ? "1 SMS partito" : `${sent.count} SMS partiti`} · ${
                sent.segments === 1
                  ? "1 SMS contato"
                  : `${sent.segments} SMS contati`
              } dal gestore. Quanto costa un SMS lo dice Twilio, non l'app.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="grid gap-2">
          <Label htmlFor="sms-campagna">Campagna</Label>
          <select
            id="sms-campagna"
            className={selectClass}
            value={campagnaId ?? ""}
            onChange={(event) =>
              setChosen(
                event.target.value === ""
                  ? null
                  : (event.target.value as Id<"campagne">),
              )
            }
          >
            <option value="">Tutte</option>
            {(campagne ?? []).map((campagna) => (
              <option key={campagna._id} value={campagna._id}>
                {campagna.name}
              </option>
            ))}
          </select>
        </div>

        {sent === undefined ? null : sent.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Non è ancora partito niente.
          </p>
        ) : (
          <ul className="grid gap-2">
            {sent.rows.map((sms) => (
              <li key={sms._id} className="rounded-lg border bg-card px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    href={`/clienti/${sms.cliente._id}`}
                    className="font-display font-bold underline-offset-4 hover:underline"
                  >
                    {clienteLabel(sms.cliente)}
                  </Link>
                  <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                    {smsWhen(sms.at)}
                  </span>
                </div>
                <p className="mt-1 text-base whitespace-pre-wrap">{sms.body}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {smsKindLabel[sms.kind]}
                  {sms.to === null
                    ? ""
                    : ` · ${phoneInNational(sms.to)}`} ·{" "}
                  <span
                    className={cn(
                      smsWentWrong(sms.delivery) &&
                        "font-semibold text-amber-700 dark:text-amber-300",
                    )}
                  >
                    {smsDeliveryLabel(sms.delivery)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Gli SMS: what the two automatic messages say, whether they go out, and what
 * has gone out so far.
 *
 * The words stay here rather than moving to Il frantoio with the mill's name
 * and telephone, because they are settled against the preview beside them: a
 * setting whose effect you can watch while you change it belongs on the screen
 * that shows it, and words that go out to two hundred people are the last
 * thing to edit on one screen and check on another (ADR-0011).
 */
export function SmsAdmin() {
  const settings = useQuery(api.sms.settings, {});
  const mill = useQuery(api.frantoio.settings, {});
  const save = useMutation(api.sms.setSettings);
  // The Admin's own edit, kept as they typed it and started from what the mill
  // is running on. Nothing is written until they say so.
  const [draft, setDraft] = useState<{
    smsRitiroTemplate: string;
    smsRitiroOn: boolean;
    smsRientroTemplate: string;
    smsRientroOn: boolean;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (settings === undefined || mill === undefined) {
    return <p className="text-sm text-muted-foreground">Un attimo…</p>;
  }
  const wanted = draft ?? settings;
  const change = (fields: Partial<typeof wanted>) => {
    setSaved(false);
    setDraft({ ...wanted, ...fields });
  };
  const untouched =
    wanted.smsRitiroTemplate === settings.smsRitiroTemplate &&
    wanted.smsRitiroOn === settings.smsRitiroOn &&
    wanted.smsRientroTemplate === settings.smsRientroTemplate &&
    wanted.smsRientroOn === settings.smsRientroOn;
  const broken =
    unknownPlaceholders(wanted.smsRitiroTemplate).length > 0 ||
    unknownPlaceholders(wanted.smsRientroTemplate).length > 0 ||
    wanted.smsRitiroTemplate.trim() === "" ||
    wanted.smsRientroTemplate.trim() === "";

  return (
    <div className="grid gap-6">
      <TemplateEditor
        id="sms-ritiro"
        title="Quando ritira"
        description="Parte da solo appena registri il Ritiro, uno per Ritiro anche se le Ceste sono sei."
        template={wanted.smsRitiroTemplate}
        on={wanted.smsRitiroOn}
        onTemplate={(smsRitiroTemplate) => change({ smsRitiroTemplate })}
        onSwitch={(smsRitiroOn) => change({ smsRitiroOn })}
        mill={mill}
      />

      <TemplateEditor
        id="sms-rientro"
        title="Quando riporta"
        description="Parte da solo appena registri il Rientro, e dice quante gliene restano."
        template={wanted.smsRientroTemplate}
        on={wanted.smsRientroOn}
        onTemplate={(smsRientroTemplate) => change({ smsRientroTemplate })}
        onSwitch={(smsRientroOn) => change({ smsRientroOn })}
        mill={mill}
      />

      <div className="grid gap-2">
        {error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {saved && <p className="text-sm text-muted-foreground">Salvato.</p>}
        <Button
          className="h-12 text-base"
          disabled={pending || untouched || broken}
          onClick={async () => {
            setError(null);
            setPending(true);
            try {
              await save(wanted);
              setDraft(null);
              setSaved(true);
            } catch {
              setError(
                "Non è stato possibile salvare. Controlla che nel testo ci siano solo le parole tra graffe che l'app conosce.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          {pending ? "Un attimo…" : "Salva gli SMS"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Nessuno può rispondere a questi messaggi: se il Cliente deve chiamare,
          il numero va scritto dentro il testo.
        </p>
      </div>

      <SmsList />
    </div>
  );
}
