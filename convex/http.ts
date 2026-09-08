import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Better Auth serves sign-in, sign-out and session refresh from this router
// (ADR-0008).
authComponent.registerRoutes(http, createAuth);

/**
 * Whether Twilio really sent this, or somebody found the address.
 *
 * The signature is Twilio's own: the URL it posted to with every form field
 * appended after it in name order, signed with the account's auth token. The
 * token proves it, which is why the endpoint needs no secret of its own and
 * why an unsigned request is simply not answered.
 *
 * The account's auth token, and not the API key `sms.ts` sends with: Twilio
 * signs with the one and never the other. A deployment holding only the key
 * therefore sends its messages perfectly well and is deaf to what became of
 * them — every callback fails here, and the rows stop at "in partenza" instead
 * of reaching "consegnato".
 */
async function fromTwilio(
  url: string,
  fields: [string, string][],
  signature: string | null,
): Promise<boolean> {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (token === undefined || token === "" || signature === null) {
    return false;
  }
  const signed = [...fields]
    .sort(([one], [other]) => (one < other ? -1 : one > other ? 1 : 0))
    .reduce((text, [name, value]) => text + name + value, url);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(token),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signed),
  );
  const ours = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return ours === signature;
}

/**
 * What became of a message after Twilio took it — delivered by the carrier, or
 * refused by it — written back onto the Sms it is about.
 *
 * This is the whole reason the mill can tell "we sent it" from "it arrived",
 * and it costs nothing: Twilio bills the message, not the callback. It is also
 * the only door this app opens to the outside besides sign-in, so it answers
 * nothing it cannot prove came from Twilio, and says as little as possible
 * when it does answer.
 */
http.route({
  path: "/twilio/status",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const fields = [...new URLSearchParams(await request.text()).entries()];
    const signature = request.headers.get("x-twilio-signature");
    if (!(await fromTwilio(request.url, fields, signature))) {
      return new Response("no", { status: 403 });
    }

    const posted = new Map(fields);
    const twilioSid = posted.get("MessageSid") ?? posted.get("SmsSid");
    const status = posted.get("MessageStatus") ?? posted.get("SmsStatus");
    if (twilioSid === undefined || status === undefined) {
      return new Response("no", { status: 400 });
    }

    await ctx.runMutation(internal.sms.recordDeliveryStatus, {
      twilioSid,
      status,
    });
    return new Response(null, { status: 204 });
  }),
});

export default http;
