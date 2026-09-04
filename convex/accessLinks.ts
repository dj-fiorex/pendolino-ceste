import { v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { allOperatori, requireAdmin } from "./operatori";
import { emailDelivered, emailDelivery, role, type Role } from "./schema";

/**
 * How long an invitation is good for. It is sent to somebody who has just been
 * taken on and who may not open their email until the evening, or until the
 * Sunday — long enough for that, short enough that a link forwarded on by
 * accident in November opens nothing in the spring.
 */
const INVITATION_LIFETIME_IN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * How long a reset is good for. Shorter, because there is nothing to wait for:
 * the Admin sends it while standing next to the person who forgot their
 * password (ADR-0008).
 */
const RESET_LIFETIME_IN_MS = 24 * 60 * 60 * 1000;

/** What a link is for, as everything outside this file names it. */
export const accessLinkKind = v.union(
  v.literal("invitation"),
  v.literal("reset"),
);

/**
 * A link as whoever has just followed it is told about it: who it is for, and
 * whether it is still worth anything.
 */
export const followedAccessLink = v.object({
  kind: accessLinkKind,
  name: v.string(),
  email: v.string(),
  expiresAt: v.number(),
  used: v.boolean(),
});

export type FollowedAccessLink = Infer<typeof followedAccessLink>;

/**
 * The secret an emailed link carries. Random, long, and never derived from the
 * address it goes to or the moment it was sent: guessing one has to be as hard
 * as guessing the password it would let somebody choose.
 */
function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Writes a link and hands it to the email that carries it.
 *
 * The send is scheduled rather than awaited, because the mutation that wrote
 * the link has already changed the mill's mind about who is coming and must
 * not be rolled back by Resend having a bad afternoon (ADR-0005). What the
 * send made of it comes back onto the row afterwards, as `delivery`.
 */
export async function sendAccessLink(
  ctx: MutationCtx,
  link: {
    email: string;
    purpose: Doc<"accessLinks">["purpose"];
    sentBy: Id<"operatori">;
  },
): Promise<Id<"accessLinks">> {
  const lifetime =
    link.purpose.kind === "invitation"
      ? INVITATION_LIFETIME_IN_MS
      : RESET_LIFETIME_IN_MS;
  const accessLinkId = await ctx.db.insert("accessLinks", {
    ...link,
    token: newToken(),
    expiresAt: Date.now() + lifetime,
    usedAt: null,
    delivery: null,
  });
  await ctx.scheduler.runAfter(0, internal.email.send, { accessLinkId });
  return accessLinkId;
}

/** The link a token names, or nobody where the token names none. */
async function byTokenOrNull(
  ctx: QueryCtx,
  token: string,
): Promise<Doc<"accessLinks"> | null> {
  return await ctx.db
    .query("accessLinks")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
}

/**
 * Spends a link: the one check that stands between a token in somebody's inbox
 * and a password of their choosing on one of the mill's accounts.
 *
 * Made in the same transaction that acts on what the link is for, and marking
 * the link used as it goes, so that two people following one invitation at
 * once cannot both come through it — a link is good once (#26).
 */
async function claimAccessLink(
  ctx: MutationCtx,
  token: string,
  kind: Doc<"accessLinks">["purpose"]["kind"],
): Promise<Doc<"accessLinks">> {
  const link = await byTokenOrNull(ctx, token);
  if (link === null || link.purpose.kind !== kind) {
    throw new Error("This link is not one the mill sent.");
  }
  if (link.usedAt !== null) {
    throw new Error("This link has already been used.");
  }
  if (link.expiresAt <= Date.now()) {
    throw new Error("This link has expired: ask an Admin for another.");
  }
  await ctx.db.patch(link._id, { usedAt: Date.now() });
  return link;
}

/**
 * Spends an invitation and says who it was for: the name and the role the
 * Admin invited them under, which is what the new Operatore is written down
 * as. The address is the link's own, never one the person following it typed.
 */
export async function claimInvitation(
  ctx: MutationCtx,
  token: string,
): Promise<{ email: string; name: string; role: Role }> {
  const link = await claimAccessLink(ctx, token, "invitation");
  const purpose = link.purpose;
  if (purpose.kind !== "invitation") {
    // Unreachable: a link of any other kind was refused above. Written out
    // because a stored document's type cannot say what the argument settled.
    throw new Error("This link is not an invitation.");
  }
  return { email: link.email, name: purpose.name, role: purpose.role };
}

/**
 * The link somebody has just followed, as the screen that asks them for a
 * password reads it: who it is for, and whether it is still good.
 *
 * The only query in the app that asks nobody to be signed in, because the
 * whole point of an invitation is that its reader has no account yet. It gives
 * away no more than the token already carries, and the token is a secret the
 * mill emailed to that address.
 *
 * Whether the link has expired is left to the device to work out from
 * `expiresAt`: a query cannot read the clock (its answer would never be
 * recomputed as the deadline passed), and refusing a stale link is the
 * mutation's job regardless.
 */
export const byToken = query({
  args: { token: v.string() },
  returns: v.union(v.null(), followedAccessLink),
  handler: async (ctx, args) => {
    const link = await byTokenOrNull(ctx, args.token);
    if (link === null) {
      return null;
    }
    return {
      kind: link.purpose.kind,
      name: await nameFor(ctx, link),
      email: link.email,
      expiresAt: link.expiresAt,
      used: link.usedAt !== null,
    };
  },
});

/** Who a link is for: the person invited, or the Operatore it resets. */
async function nameFor(
  ctx: QueryCtx,
  link: Doc<"accessLinks">,
): Promise<string> {
  if (link.purpose.kind === "invitation") {
    return link.purpose.name;
  }
  const operatore = await ctx.db.get(link.purpose.operatoreId);
  if (operatore === null) {
    // An Operatore is deactivated, never deleted (ADR-0004).
    throw new Error("A link names an Operatore that is gone.");
  }
  return operatore.name;
}

/**
 * The invitations the mill is still waiting on: sent, not yet accepted. Shown
 * to an Admin under the staff who have accepted theirs, with what became of
 * the email — an invitation Resend never took is the one thing the Admin has
 * to know about (ADR-0008).
 *
 * The token is not here. Email is the only invitation channel (#26), and a
 * screen that showed the link would be a second one.
 *
 * An Admin who invites the same person twice sends two links, and whichever
 * one is accepted leaves the other unusable but unspent. So this asks the
 * staff as well: an invitation to somebody already at the counter is waiting
 * for nothing.
 */
export const pending = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("accessLinks"),
      name: v.string(),
      email: v.string(),
      role,
      sentAt: v.number(),
      expiresAt: v.number(),
      delivery: emailDelivery,
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const links = await ctx.db
      .query("accessLinks")
      .withIndex("by_usedAt", (q) => q.eq("usedAt", null))
      .order("desc")
      .collect();
    const staff = await allOperatori(ctx);
    const arrived = new Set(staff.map((operatore) => operatore.email));
    return links.flatMap((link) =>
      link.purpose.kind === "invitation" && !arrived.has(link.email)
        ? [
            {
              _id: link._id,
              name: link.purpose.name,
              email: link.email,
              role: link.purpose.role,
              sentAt: link._creationTime,
              expiresAt: link.expiresAt,
              delivery: link.delivery,
            },
          ]
        : [],
    );
  },
});

/**
 * A link as the email carrying it needs it: the token to put in the URL, who
 * to greet, and who to say it comes from.
 *
 * Internal, because this is the one read that gives the token away, and the
 * only thing on the far side of it is the message going out to the person the
 * link is already for.
 */
export const get = internalQuery({
  args: { accessLinkId: v.id("accessLinks") },
  returns: v.union(
    v.null(),
    v.object({
      kind: accessLinkKind,
      token: v.string(),
      name: v.string(),
      email: v.string(),
      expiresAt: v.number(),
      sentBy: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.accessLinkId);
    if (link === null) {
      return null;
    }
    const sentBy = await ctx.db.get(link.sentBy);
    if (sentBy === null) {
      throw new Error("A link names an Operatore that is gone.");
    }
    return {
      kind: link.purpose.kind,
      token: link.token,
      name: await nameFor(ctx, link),
      email: link.email,
      expiresAt: link.expiresAt,
      sentBy: sentBy.name,
    };
  },
});

/** What Resend made of the email carrying a link, once it is known. */
export const delivered = internalMutation({
  args: { accessLinkId: v.id("accessLinks"), delivery: emailDelivered },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.accessLinkId, { delivery: args.delivery });
    return null;
  },
});

/**
 * Spends a reset link and says which account it was for. The password itself
 * is set outside a transaction, because hashing one is not something a
 * transaction can do — so the link is spent first and the password follows: a
 * reset that fails halfway leaves an account nobody has got into and a link
 * nobody can use twice, which is the safe half to fail on.
 */
export const claimReset = internalMutation({
  args: { token: v.string() },
  returns: v.object({ email: v.string() }),
  handler: async (ctx, args) => {
    const link = await claimAccessLink(ctx, args.token, "reset");
    return { email: link.email };
  },
});
