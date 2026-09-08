import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireAdmin, requireOperatore } from "./operatori";
import { isSendable, readPhone } from "./phone";
import { writeRegistroRow } from "./registro";
import {
  smsDelivery,
  smsKind,
  smsSettingField,
  smsSettingsFields,
  type SmsKind,
  type SmsSettingField,
  type SmsSettings,
  type SmsUnsendable,
} from "./schema";
import { millSettings, saveMillSettings } from "./settings";
import {
  cesteInWords,
  renderTemplate,
  segmentsOf,
  tidyForSms,
  unknownPlaceholders,
  type SmsValues,
} from "./template";

/**
 * How many Ceste this Cliente is holding: what `{{totale}}` says, read after
 * the movement has been recorded, because the receipt is about where he stands
 * now and not where he stood a moment ago.
 */
async function cesteFuoriCount(
  ctx: QueryCtx,
  clienteId: Id<"clienti">,
): Promise<number> {
  const ceste = await ctx.db
    .query("ceste")
    .withIndex("by_cliente_and_state", (q) =>
      q.eq("clienteId", clienteId).eq("state", "fuori"),
    )
    .collect();
  return ceste.length;
}

/**
 * What the placeholders stand for on this occasion. The mill's own name and
 * telephone come out of the settings it already keeps for the Etichetta: a
 * frantoio has one of each, and typing it twice is how the two come to
 * disagree.
 */
async function valuesFor(
  ctx: QueryCtx,
  cliente: Doc<"clienti">,
  moved: number[],
): Promise<SmsValues> {
  const settings = await millSettings(ctx);
  return {
    nome: cliente.name,
    ceste: cesteInWords(moved.length),
    totale: cesteInWords(await cesteFuoriCount(ctx, cliente._id)),
    numeri: moved.join(", "),
    frantoio: settings.millName,
    telefono: settings.millPhone,
  };
}

/**
 * Why a message the mill meant to send cannot go, or nothing where it can.
 * The stored telephone is read rather than trusted: it is E.164 by the time it
 * is stored (ADR-0009), and a landline stored for the Lista di recupero's
 * "Chiama" button is a good number that no Sms will reach.
 */
function whyNot(cliente: Doc<"clienti">): SmsUnsendable | null {
  if (cliente.phone === null) {
    return "no_phone";
  }
  const reading = readPhone(cliente.phone);
  if (isSendable(reading)) {
    return null;
  }
  return reading.kind === "landline" ? "landline" : "unreadable";
}

/**
 * Writes down one Sms and hands it to the scheduler.
 *
 * Written inside the mutation that caused it and sent from outside it: a
 * mutation is a transaction and cannot talk to Twilio, and the counter must
 * not wait on a carrier to register a Ritiro (ADR-0005). So the row is the
 * transactional half — the words, the number, the action they belong to — and
 * the action that follows only carries them out.
 *
 * A message that cannot go is written down all the same, with the reason on
 * it. That row is the whole point: it is what tells the mill, in November,
 * that a farmer it thought it had warned has no telephone in the registry.
 */
async function writeSms(
  ctx: MutationCtx,
  sms: {
    cliente: Doc<"clienti">;
    kind: SmsKind;
    body: string;
    registroId: Id<"registro">;
    operatoreId: Id<"operatori">;
    campagnaId?: Id<"campagne">;
  },
): Promise<Id<"sms">> {
  const at = Date.now();
  const unsendable = whyNot(sms.cliente);
  const smsId = await ctx.db.insert("sms", {
    clienteId: sms.cliente._id,
    kind: sms.kind,
    body: sms.body,
    to: unsendable === null ? sms.cliente.phone : null,
    registroId: sms.registroId,
    operatoreId: sms.operatoreId,
    campagnaId: sms.campagnaId,
    delivery:
      unsendable === null
        ? { kind: "queued", at }
        : { kind: "unsendable", at, reason: unsendable },
  });
  if (unsendable === null && sms.cliente.phone !== null) {
    await ctx.scheduler.runAfter(0, internal.sms.deliver, {
      smsId,
      to: sms.cliente.phone,
      body: sms.body,
    });
  }
  return smsId;
}

/**
 * The receipt a Ritiro or a Rientro sends of itself, where the mill has asked
 * for one.
 *
 * Called at the end of the mutation that recorded the movement, so that
 * `{{totale}}` counts the Ceste as they now stand. One Sms per action and
 * never one per Cesta: six Ceste leaving together are one message, as they are
 * one Registro row (ADR-0006, CONTEXT.md).
 *
 * Two things silence it, and neither leaves a row behind: the switch for this
 * kind of message being off, and this Cliente having asked not to be written
 * to. Both are the mill's own decision, and a row a season saying "as
 * instructed, nothing was sent" is noise.
 */
export async function sendMovimentoSms(
  ctx: MutationCtx,
  movimento: {
    kind: "ritiro" | "rientro";
    cliente: Doc<"clienti">;
    numeri: number[];
    registroId: Id<"registro">;
    operatoreId: Id<"operatori">;
    campagnaId?: Id<"campagne">;
  },
): Promise<void> {
  const settings = await millSettings(ctx);
  const on =
    movimento.kind === "ritiro" ? settings.smsRitiroOn : settings.smsRientroOn;
  if (!on || movimento.cliente.smsOptOut === true) {
    return;
  }
  const template =
    movimento.kind === "ritiro"
      ? settings.smsRitiroTemplate
      : settings.smsRientroTemplate;
  const body = tidyForSms(
    renderTemplate(
      template,
      await valuesFor(ctx, movimento.cliente, movimento.numeri),
    ),
  );
  await writeSms(ctx, { ...movimento, body });
}

/**
 * Hands one message to Twilio, and says what became of it.
 *
 * The whole of the app's contact with a carrier, as `email.ts` is the whole of
 * its contact with the post. It knows nothing about Ritiri or Clienti: a
 * number, some words, and a row to write the answer back to.
 *
 * On a deployment in prova nothing is handed over. The message is built
 * exactly as it would have been and goes to the logs instead, so that trying
 * the feature out does not put a real message on a real farmer's telephone.
 */
export const deliver = internalAction({
  args: { smsId: v.id("sms"), to: v.string(), body: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      if (testMode()) {
        console.log(
          `TWILIO_TEST_MODE: nothing was sent to ${args.to}.\n${args.body}`,
        );
        await ctx.runMutation(internal.sms.recordSend, {
          smsId: args.smsId,
          outcome: { kind: "withheld" },
        });
        return null;
      }
      const sid = await postToTwilio(args.to, args.body);
      await ctx.runMutation(internal.sms.recordSend, {
        smsId: args.smsId,
        outcome: { kind: "sent", twilioSid: sid },
      });
    } catch (error) {
      // Everything that can go wrong lands here and on the row: a refusal
      // from Twilio, and a deployment misconfigured so badly that it cannot
      // tell whether it is pretending. A message stuck reading "in partenza"
      // for ever tells the mill nothing; one that says why it failed does.
      //
      // Written down and not retried. A message Twilio would not take is
      // almost always a number that will not take it either, and a retry
      // duplicates the ones that were only unlucky while costing money on all
      // of them.
      await ctx.runMutation(internal.sms.recordSend, {
        smsId: args.smsId,
        outcome: {
          kind: "failed",
          reason: error instanceof Error ? error.message : String(error),
        },
      });
    }
    return null;
  },
});

/** Whether this deployment only pretends to send, as `RESEND_TEST_MODE` is. */
function testMode(): boolean {
  const set = process.env.TWILIO_TEST_MODE?.trim().toLowerCase();
  if (set === undefined || set === "" || set === "false") {
    return false;
  }
  if (set === "true") {
    return true;
  }
  throw new Error(
    `TWILIO_TEST_MODE is "${process.env.TWILIO_TEST_MODE}" on this deployment, which is neither true nor false.`,
  );
}

/**
 * What a deployment cannot send without, read where it is needed.
 *
 * Two SIDs and not one, because Twilio's are two different things. The account
 * is what the message is filed under and what gets billed for it, and it names
 * the address the message is posted to; the API key only proves the caller is
 * allowed to post it. Keeping them apart is the point: a key is revoked and
 * reissued from the console in a minute, and the account's own password — the
 * auth token, which opens everything — never has to be written onto a
 * deployment to send a message.
 *
 * The auth token is still read, but in `http.ts` and for one job only: Twilio
 * signs its delivery callbacks with the account token and with nothing else,
 * so a deployment that has none is deaf to them. It cannot send without these
 * four; it can send perfectly well without that one.
 */
function twilioAccount(): {
  accountSid: string;
  keySid: string;
  keySecret: string;
  from: string;
} {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const keySid = process.env.TWILIO_API_KEY_SID;
  const keySecret = process.env.TWILIO_API_KEY_SECRET;
  const from = process.env.TWILIO_FROM;
  if (!accountSid || !keySid || !keySecret || !from) {
    throw new Error(
      "TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET and TWILIO_FROM are not all set on this deployment: no Sms can go out.",
    );
  }
  return { accountSid, keySid, keySecret, from };
}

/**
 * Where Twilio reports what became of a message afterwards, and nothing where
 * this deployment does not know its own address. Asking for the callback is
 * free; a message sent without one only leaves the mill knowing less.
 */
function statusCallback(): string | null {
  const site = process.env.CONVEX_SITE_URL;
  return site === undefined || site === "" ? null : `${site}/twilio/status`;
}

/** The message itself, as Twilio's own API takes it. The name it gives back. */
async function postToTwilio(to: string, body: string): Promise<string> {
  const { accountSid, keySid, keySecret, from } = twilioAccount();
  const form = new URLSearchParams({ To: to, From: from, Body: body });
  const callback = statusCallback();
  if (callback !== null) {
    form.set("StatusCallback", callback);
  }
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(`${keySid}:${keySecret}`)}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    },
  );
  if (!response.ok) {
    throw new Error(
      `Twilio refused the message: ${response.status} ${await response.text()}`,
    );
  }
  const taken: unknown = await response.json();
  const named =
    typeof taken === "object" &&
    taken !== null &&
    "sid" in taken &&
    typeof taken.sid === "string";
  if (!named) {
    throw new Error("Twilio took the message without naming it.");
  }
  return (taken as { sid: string }).sid;
}

/**
 * What the send came to, written back onto the row the mutation left behind.
 *
 * The row is patched rather than replaced, and only here and at the callback:
 * an Sms is the one thing in this app that learns something about itself after
 * the fact, which is why it has a table of its own and does not live on the
 * Registro row that caused it (ADR-0004).
 */
export const recordSend = internalMutation({
  args: {
    smsId: v.id("sms"),
    outcome: v.union(
      v.object({ kind: v.literal("sent"), twilioSid: v.string() }),
      v.object({ kind: v.literal("withheld") }),
      v.object({ kind: v.literal("failed"), reason: v.string() }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const at = Date.now();
    if (args.outcome.kind === "sent") {
      await ctx.db.patch(args.smsId, {
        delivery: { kind: "sent", at },
        twilioSid: args.outcome.twilioSid,
      });
      return null;
    }
    await ctx.db.patch(args.smsId, {
      delivery:
        args.outcome.kind === "withheld"
          ? { kind: "withheld", at }
          : { kind: "failed", at, reason: args.outcome.reason },
    });
    return null;
  },
});

/**
 * What the carrier made of a message, minutes after Twilio took it: the one
 * piece of news that turns "we sent it" into "it arrived".
 *
 * A callback about a message this deployment does not know is dropped rather
 * than raised — the endpoint is on the open internet, and a deployment restored
 * from a backup will be told about messages it never sent.
 */
export const recordDeliveryStatus = internalMutation({
  args: { twilioSid: v.string(), status: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sms = await ctx.db
      .query("sms")
      .withIndex("by_twilioSid", (q) => q.eq("twilioSid", args.twilioSid))
      .first();
    if (sms === null) {
      return null;
    }
    const at = Date.now();
    if (args.status === "delivered") {
      await ctx.db.patch(sms._id, { delivery: { kind: "delivered", at } });
      return null;
    }
    if (args.status === "undelivered" || args.status === "failed") {
      await ctx.db.patch(sms._id, {
        delivery: { kind: "failed", at, reason: args.status },
      });
    }
    // Every other status — queued, sending, accepted — is Twilio saying the
    // message is still on its way, which the row already says.
    return null;
  },
});

/**
 * What the mill's Sms say and whether they are sent. An Admin's, like the
 * screen that edits them.
 */
export const settings = query({
  args: {},
  returns: v.object(smsSettingsFields),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return smsSettingsOf(await millSettings(ctx));
  },
});

/** The four of them, out of the one row the whole mill's settings share. */
const smsSettingsOf = (settings: SmsSettings): SmsSettings => ({
  smsRitiroTemplate: settings.smsRitiroTemplate,
  smsRitiroOn: settings.smsRitiroOn,
  smsRientroTemplate: settings.smsRientroTemplate,
  smsRientroOn: settings.smsRientroOn,
});

/**
 * An Admin settles what the two automatic messages say, and whether they go
 * out at all.
 *
 * A template asking for a placeholder that does not exist is refused, naming
 * it. This is the one place in the app that refuses rather than records, and
 * it is not the counter: an Admin at a desk can be told to fix a typo, and
 * two hundred farmers reading «Gentile {{cognme}}» cannot be untold
 * (ADR-0005 covers the counter, and this is not it).
 *
 * The Registro row names only what actually changed, with the words before and
 * the words after (ADR-0006).
 */
export const setSettings = mutation({
  args: smsSettingsFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const wanted: SmsSettings = {
      smsRitiroTemplate: tidyForSms(args.smsRitiroTemplate.trim()),
      smsRitiroOn: args.smsRitiroOn,
      smsRientroTemplate: tidyForSms(args.smsRientroTemplate.trim()),
      smsRientroOn: args.smsRientroOn,
    };
    for (const template of [
      wanted.smsRitiroTemplate,
      wanted.smsRientroTemplate,
    ]) {
      if (template === "") {
        throw new Error("An Sms with no words in it is not a message.");
      }
      const unknown = unknownPlaceholders(template);
      if (unknown.length > 0) {
        throw new Error(
          `This message asks for something the app cannot fill in: ${unknown
            .map((name) => `{{${name}}}`)
            .join(", ")}.`,
        );
      }
    }

    const before = smsSettingsOf(await millSettings(ctx));
    const changes = smsSettingField.members
      .map((member) => member.value as SmsSettingField)
      .filter((field) => before[field] !== wanted[field])
      .map((field) => ({
        field,
        before: before[field],
        after: wanted[field],
      }));
    if (changes.length === 0) {
      return null;
    }

    await saveMillSettings(ctx, wanted);
    await writeRegistroRow(ctx, {
      operatoreId: admin._id,
      action: { kind: "sms_settings", changes },
    });
    return null;
  },
});

/**
 * An Admin writes to a Cliente himself: the chase-up that no automatic receipt
 * covers.
 *
 * An Admin's and no Operatore's, because this is free words going out over the
 * mill's name at the mill's expense — a different power from recording a
 * Ritiro. Unlike an automatic Sms this one is an action a person took, so it
 * gets its own Registro row carrying what was said (ADR-0006).
 *
 * A Cliente who asked not to be written to is written to only deliberately,
 * and the row says the Admin overrode it.
 */
export const send = mutation({
  args: {
    clienteId: v.id("clienti"),
    body: v.string(),
    // The Admin has been told this Cliente asked not to be written to, and
    // means to write to them anyway.
    overrideOptOut: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const cliente = await ctx.db.get(args.clienteId);
    if (cliente === null) {
      throw new Error("This Cliente is not in the registry.");
    }
    if (cliente.smsOptOut === true && !args.overrideOptOut) {
      throw new Error(
        "This Cliente asked not to be written to: sending anyway needs a confirmation.",
      );
    }
    const unknown = unknownPlaceholders(args.body);
    if (unknown.length > 0) {
      throw new Error(
        `This message asks for something the app cannot fill in: ${unknown
          .map((name) => `{{${name}}}`)
          .join(", ")}.`,
      );
    }
    // Rendered against the Ceste he holds now: a manual message is written
    // about somebody in particular, so the same placeholders stand for the
    // same things they do in a receipt. `{{ceste}}` is those Ceste — there is
    // no movement here, so what he holds is what this message is about.
    const fuori = await cesteFuoriNumeri(ctx, cliente._id);
    const body = tidyForSms(
      renderTemplate(args.body, await valuesFor(ctx, cliente, fuori)).trim(),
    );
    if (body === "") {
      throw new Error("An Sms with no words in it is not a message.");
    }
    const unsendable = whyNot(cliente);
    if (unsendable !== null) {
      throw new Error(
        "This Cliente has no telephone an Sms can reach: the message was not sent.",
      );
    }

    const registroId = await writeRegistroRow(ctx, {
      operatoreId: admin._id,
      clienteId: cliente._id,
      action: {
        kind: "sms_inviato",
        body,
        to: cliente.phone ?? "",
        overrodeOptOut: cliente.smsOptOut === true,
      },
    });
    await writeSms(ctx, {
      cliente,
      kind: "manuale",
      body,
      registroId,
      operatoreId: admin._id,
    });
    return null;
  },
});

/** The numeri of the Ceste a Cliente is holding, as a message reads them out. */
async function cesteFuoriNumeri(
  ctx: QueryCtx,
  clienteId: Id<"clienti">,
): Promise<number[]> {
  const ceste = await ctx.db
    .query("ceste")
    .withIndex("by_cliente_and_state", (q) =>
      q.eq("clienteId", clienteId).eq("state", "fuori"),
    )
    .collect();
  return ceste.map((cesta) => cesta.numero).sort((one, other) => one - other);
}

/**
 * The Cliente an Sms went to, as a screen names them. Written out here rather
 * than borrowed from `clienti.ts`, so that this file and that one do not have
 * to be loaded in a particular order: the Movimenti already import both.
 */
const clienteNamed = {
  _id: v.id("clienti"),
  name: v.string(),
  alias: v.array(v.string()),
};

/**
 * What the placeholders would say for one Cliente right now: what the manual
 * composer previews against, so that the sentence an Admin reads before
 * sending is the sentence that goes out and not an approximation of it.
 */
export const previewValues = query({
  args: { clienteId: v.id("clienti") },
  returns: v.object({
    nome: v.string(),
    ceste: v.string(),
    totale: v.string(),
    numeri: v.string(),
    frantoio: v.string(),
    telefono: v.string(),
  }),
  handler: async (ctx, args) => {
    await requireOperatore(ctx);
    const cliente = await ctx.db.get(args.clienteId);
    if (cliente === null) {
      throw new Error("This Cliente is not in the registry.");
    }
    return await valuesFor(
      ctx,
      cliente,
      await cesteFuoriNumeri(ctx, cliente._id),
    );
  },
});

/** One Sms as a screen shows it. */
const smsShape = {
  _id: v.id("sms"),
  at: v.number(),
  kind: smsKind,
  body: v.string(),
  to: v.union(v.null(), v.string()),
  delivery: smsDelivery,
  operatore: v.string(),
};

/** The Sms as a row, with whoever registered it named. */
async function asSms(ctx: QueryCtx, sms: Doc<"sms">) {
  const operatore = await ctx.db.get(sms.operatoreId);
  return {
    _id: sms._id,
    at: sms._creationTime,
    kind: sms.kind,
    body: sms.body,
    to: sms.to,
    delivery: sms.delivery,
    operatore: operatore?.name ?? "",
  };
}

/**
 * Everything the mill has written to one Cliente, newest first.
 *
 * Readable by every Operatore, body and all. These are the mill writing to its
 * own customer about Ceste, and the Operatore who has to make the follow-up
 * call is the one who most needs to know what was already said.
 */
export const byCliente = query({
  args: { clienteId: v.id("clienti") },
  returns: v.array(v.object(smsShape)),
  handler: async (ctx, args) => {
    await requireOperatore(ctx);
    const rows = await ctx.db
      .query("sms")
      .withIndex("by_cliente", (q) => q.eq("clienteId", args.clienteId))
      .order("desc")
      .collect();
    return await Promise.all(rows.map((sms) => asSms(ctx, sms)));
  },
});

/**
 * The Sms of one Campagna, newest first, with what the season has cost so far
 * in messages and in segments.
 *
 * Segments and not euros: the app knows exactly how long each message was and
 * how many the carrier billed, and it does not know what Twilio charges. A
 * figure in euros typed into a settings box goes stale the first time a rate
 * moves, and a wrong number said with confidence is worse than a right one
 * that needs multiplying.
 */
export const list = query({
  args: { campagnaId: v.optional(v.id("campagne")) },
  returns: v.object({
    rows: v.array(v.object({ ...smsShape, cliente: v.object(clienteNamed) })),
    // What the mill has spent this season, as the mill can check it.
    count: v.number(),
    segments: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows =
      args.campagnaId === undefined
        ? await ctx.db.query("sms").order("desc").collect()
        : await ctx.db
            .query("sms")
            .withIndex("by_campagna", (q) =>
              q.eq("campagnaId", args.campagnaId),
            )
            .order("desc")
            .collect();

    const withCliente = await Promise.all(
      rows.map(async (sms) => {
        const cliente = await ctx.db.get(sms.clienteId);
        if (cliente === null) {
          // A Cliente is deactivated but never deleted (ADR-0004).
          throw new Error("An Sms names a Cliente that is gone.");
        }
        return {
          ...(await asSms(ctx, sms)),
          cliente: {
            _id: cliente._id,
            name: cliente.name,
            alias: cliente.alias,
          },
        };
      }),
    );
    // Only what actually went out is counted: a message the mill could not
    // send cost it nothing, and a count that included it would be a bill the
    // mill never had.
    const billed = rows.filter(
      (sms) =>
        sms.delivery.kind === "sent" || sms.delivery.kind === "delivered",
    );
    return {
      rows: withCliente,
      count: billed.length,
      segments: billed.reduce(
        (total, sms) => total + segmentsOf(sms.body).segments,
        0,
      ),
    };
  },
});
