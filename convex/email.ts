import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { MILL_TIME_ZONE } from "./schema";

/**
 * The app's whole contact with the outside world's mail: one message, handed
 * to Resend (ADR-0008).
 *
 * Everything else about an invitation or a reset — who it is for, how long it
 * is good for, what it opens — is the app's own and is decided elsewhere. This
 * is a transport and knows none of it, which is what keeps the mill's tests
 * from ever posting anything to anybody: nothing sends without a key, and no
 * key is set where the tests run.
 */
type Message = { to: string; subject: string; text: string };

/**
 * What the mill's mail goes out as. Resend will only send from a domain the
 * account has verified, so this belongs to the deployment rather than to the
 * code.
 */
function from(): string {
  return process.env.RESEND_FROM ?? "Pendolino Ceste <onboarding@resend.dev>";
}

/** Where the links point: this app, as the mill reaches it. */
function siteUrl(): string {
  const url = process.env.SITE_URL;
  if (url === undefined || url === "") {
    throw new Error(
      "SITE_URL is not set on this deployment: a link would point nowhere.",
    );
  }
  return url;
}

async function deliver(message: Message): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (key === undefined || key === "") {
    throw new Error(
      "RESEND_API_KEY is not set on this deployment: no email can go out.",
    );
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: from(),
      to: [message.to],
      subject: message.subject,
      text: message.text,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Resend refused the message: ${response.status} ${await response.text()}`,
    );
  }
}

/** The day a link stops working, as the mill reads a date. */
function dateOf(at: number): string {
  return new Date(at).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    timeZone: MILL_TIME_ZONE,
  });
}

/** The link a person is being sent, as the message carrying it needs it. */
type AccessLink = {
  kind: "invitation" | "reset";
  token: string;
  name: string;
  email: string;
  expiresAt: number;
  sentBy: string;
};

/**
 * What the mill writes to somebody it is inviting, and to somebody who has
 * forgotten their password. In Italian, like everything the staff read, and in
 * plain text: it is four lines and a link, and it has to open on the phone
 * somebody is holding in the yard.
 */
function messageFor(link: AccessLink): Message {
  const url = `${siteUrl()}/password/${link.token}`;
  const until = `Il link vale fino al ${dateOf(link.expiresAt)}. Dopo, chiedine un altro a un Admin del frantoio.`;
  return link.kind === "invitation"
    ? {
        to: link.email,
        subject: "Il tuo accesso a Pendolino Ceste",
        text: [
          `Ciao ${link.name},`,
          `${link.sentBy} ti ha invitato a Pendolino Ceste, l'app con cui il frantoio tiene il conto delle Ceste.`,
          `Scegli la tua password qui:\n${url}`,
          until,
        ].join("\n\n"),
      }
    : {
        to: link.email,
        subject: "La tua password di Pendolino Ceste",
        text: [
          `Ciao ${link.name},`,
          `${link.sentBy} ti ha mandato un link per rifare la tua password di Pendolino Ceste.`,
          `Scegli la nuova password qui:\n${url}`,
          until,
        ].join("\n\n"),
      };
}

/** The reason a send failed, as the Admin who sent it will read it. */
function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Sends the email carrying one link, and writes down what became of it.
 *
 * Scheduled by the mutation that wrote the link, and never awaited by it: an
 * invitation the Admin has recorded is not undone by Resend being down. A
 * failure is written onto the link rather than thrown, because there is nobody
 * left to throw it at by the time this runs — the Admin has gone back to the
 * counter, and the staff screen is where they will see it (ADR-0008).
 */
export const send = internalAction({
  args: { accessLinkId: v.id("accessLinks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const link = await ctx.runQuery(internal.accessLinks.get, {
      accessLinkId: args.accessLinkId,
    });
    if (link === null) {
      return null;
    }
    try {
      await deliver(messageFor(link));
      await ctx.runMutation(internal.accessLinks.delivered, {
        accessLinkId: args.accessLinkId,
        delivery: { kind: "sent", at: Date.now() },
      });
    } catch (error) {
      await ctx.runMutation(internal.accessLinks.delivered, {
        accessLinkId: args.accessLinkId,
        delivery: { kind: "failed", at: Date.now(), reason: reasonOf(error) },
      });
    }
    return null;
  },
});
