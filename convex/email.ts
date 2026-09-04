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
 * from ever posting anything to anybody: nothing sends without a key, no key
 * is set where the tests run, and a deployment can say outright that it is
 * only pretending (RESEND_TEST_MODE).
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

/**
 * Whether this deployment only pretends to send. Set on a deployment somebody
 * is working against, so that inviting yourself to try the flow does not put a
 * real message in a real inbox — and so that a mill's own address is never
 * written to twice over by a developer.
 *
 * A value that is neither true nor false is refused rather than guessed at:
 * guessing false posts real mail on a deployment that asked not to, and
 * guessing true swallows the invitation an Admin is waiting on. The refusal
 * lands on the link, and so on the Operatori screen, like any other reason an
 * email did not go out.
 */
function testMode(): boolean {
  const set = process.env.RESEND_TEST_MODE?.trim().toLowerCase();
  if (set === undefined || set === "" || set === "false") {
    return false;
  }
  if (set === "true") {
    return true;
  }
  throw new Error(
    `RESEND_TEST_MODE is "${process.env.RESEND_TEST_MODE}" on this deployment, which is neither true nor false.`,
  );
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

/**
 * Hands one message to Resend, and says what became of it. On a deployment in
 * prova nothing is handed over: the message is built exactly as it would have
 * been, so that a missing SITE_URL still fails here rather than in October,
 * and it goes to the logs instead — where whoever is trying the flow reads the
 * link straight out of the Convex dashboard. No key is needed to do that.
 */
async function deliver(message: Message): Promise<"sent" | "withheld"> {
  if (testMode()) {
    console.log(
      `RESEND_TEST_MODE: nothing was sent to ${message.to}.\n${message.subject}\n\n${message.text}`,
    );
    return "withheld";
  }
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
  return "sent";
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
      const kind = await deliver(messageFor(link));
      await ctx.runMutation(internal.accessLinks.delivered, {
        accessLinkId: args.accessLinkId,
        delivery: { kind, at: Date.now() },
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
