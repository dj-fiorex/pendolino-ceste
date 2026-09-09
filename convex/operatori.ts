import { v } from "convex/values";
import { claimInvitation, sendAccessLink } from "./accessLinks";
import type { Doc } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { writeRegistroRow } from "./registro";
import { role, tidy } from "./schema";

/**
 * The Operatore behind this request — and, when it is nobody, which of the
 * three ways of being nobody this is.
 *
 * They are worth telling apart, because only the deployment logs ever read
 * them and they call for opposite answers: a device whose connection is not
 * authenticated yet is a screen that should have waited, an account with no
 * Operatore against it is a person the mill never took on, and a deactivated
 * one is a person it has since let go. Said as a single "nobody is signed in"
 * the three are indistinguishable in the logs, which is where somebody is
 * trying to work out which of them they are looking at.
 */
type Behind =
  | { operatore: Doc<"operatori"> }
  | { operatore: null; refusal: string };

async function behindTheRequest(ctx: QueryCtx): Promise<Behind> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return {
      operatore: null,
      refusal: "No session on this device: nobody is signed in.",
    };
  }
  const operatore = await ctx.db
    .query("operatori")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", identity.subject))
    .unique();
  if (operatore === null) {
    return {
      operatore: null,
      refusal: `Signed in as ${identity.subject}, but the mill has no Operatore against that account.`,
    };
  }
  if (!operatore.active) {
    return {
      operatore: null,
      refusal: `The Operatore ${operatore.name} has been deactivated.`,
    };
  }
  return { operatore };
}

/**
 * The Operatore behind this request, or null when there is none.
 *
 * Everything the app records is attributed to whoever this returns, so a
 * deactivated Operatore reads as nobody: their account can no longer act,
 * whatever session their device still holds (#26).
 */
export async function currentOperatore(
  ctx: QueryCtx,
): Promise<Doc<"operatori"> | null> {
  return (await behindTheRequest(ctx)).operatore;
}

/** The same, for the functions that have nothing to say to a stranger. */
export async function requireOperatore(
  ctx: QueryCtx,
): Promise<Doc<"operatori">> {
  const behind = await behindTheRequest(ctx);
  if (behind.operatore === null) {
    throw new Error(behind.refusal);
  }
  return behind.operatore;
}

/**
 * The Admin behind this request. Admin gates the fleet, the Rettifica, the
 * Campagne, the staff and the Registro (spec #1); the screens hide those, and
 * this is what actually refuses them.
 */
export async function requireAdmin(ctx: QueryCtx): Promise<Doc<"operatori">> {
  const operatore = await requireOperatore(ctx);
  if (operatore.role !== "admin") {
    throw new Error("This action is reserved to an Admin.");
  }
  return operatore;
}

/** The Operatore signed in on this device, or null when nobody is. */
export const current = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ name: v.string(), email: v.string(), role }),
  ),
  handler: async (ctx) => {
    const operatore = await currentOperatore(ctx);
    if (operatore === null) {
      return null;
    }
    return {
      name: operatore.name,
      email: operatore.email,
      role: operatore.role,
    };
  },
});

/**
 * The mill's staff, past and present. Read whole rather than through an index:
 * a frantoio has five people at the counter, and every screen that shows them
 * shows all of them.
 */
export async function allOperatori(ctx: QueryCtx): Promise<Doc<"operatori">[]> {
  const operatori = await ctx.db.query("operatori").collect();
  return operatori.sort((one, other) =>
    one.name.localeCompare(other.name, "it"),
  );
}

/** An address as an account answers to it: no stray spaces, no capitals. */
function asEmail(email: string): string {
  const wanted = tidy(email).toLowerCase();
  if (!wanted.includes("@")) {
    throw new Error("An Operatore is invited at an email address.");
  }
  return wanted;
}

/** The Operatore an address already belongs to, deactivated ones included. */
async function operatoreAt(
  ctx: QueryCtx,
  email: string,
): Promise<Doc<"operatori"> | null> {
  const operatori = await allOperatori(ctx);
  return operatori.find((operatore) => operatore.email === email) ?? null;
}

/** The Operatore a mutation was asked to act on. */
async function requireStaff(
  ctx: QueryCtx,
  operatoreId: Doc<"operatori">["_id"],
): Promise<Doc<"operatori">> {
  const operatore = await ctx.db.get(operatoreId);
  if (operatore === null) {
    throw new Error("This Operatore is not one of the mill's.");
  }
  return operatore;
}

/**
 * The mill's staff as the Admin who invites and deactivates them sees them:
 * everyone who has ever held an account, with the role they hold and whether
 * they are still in play. Nobody is ever removed from this list (ADR-0004) —
 * the Movimenti of a departed Operatore stay attributed to them, and a name
 * with nothing behind it is how a history reads afterwards.
 */
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("operatori"),
      name: v.string(),
      email: v.string(),
      role,
      active: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return (await allOperatori(ctx)).map((operatore) => ({
      _id: operatore._id,
      name: operatore.name,
      email: operatore.email,
      role: operatore.role,
      active: operatore.active,
    }));
  },
});

/**
 * An Admin asks somebody to join the mill's staff, at an address of their own.
 * The invitation goes out by email and by nothing else (#26): what comes back
 * is a person who has chosen their own password, so that nobody at this mill
 * ever types one somebody else picked for them.
 *
 * The role is settled here rather than at acceptance, because inviting a
 * second Admin is how the mill stops depending on one (ADR-0008).
 */
export const invite = mutation({
  args: { name: v.string(), email: v.string(), role },
  returns: v.id("accessLinks"),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const name = tidy(args.name);
    if (name === "") {
      throw new Error("An Operatore is invited by name.");
    }
    const email = asEmail(args.email);
    const taken = await operatoreAt(ctx, email);
    if (taken !== null) {
      throw new Error(
        `${taken.name} already holds the account at this address.`,
      );
    }

    const accessLinkId = await sendAccessLink(ctx, {
      email,
      purpose: { kind: "invitation", name, role: args.role },
      sentBy: admin._id,
    });
    await writeRegistroRow(ctx, {
      operatoreId: admin._id,
      action: { kind: "operatore_invitato", name, email, role: args.role },
    });
    return accessLinkId;
  },
});

/**
 * An Admin sends an Operatore a link to set a new password. The only reset
 * there is: the mill's staff do not read email in the yard, and the Admin is
 * standing next to whoever has forgotten theirs (ADR-0008).
 */
export const sendPasswordReset = mutation({
  args: { operatoreId: v.id("operatori") },
  returns: v.id("accessLinks"),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const operatore = await requireStaff(ctx, args.operatoreId);
    if (!operatore.active) {
      throw new Error(
        `${operatore.name} is no longer in play: a password would open nothing.`,
      );
    }

    const accessLinkId = await sendAccessLink(ctx, {
      email: operatore.email,
      purpose: { kind: "reset", operatoreId: operatore._id },
      sentBy: admin._id,
    });
    await writeRegistroRow(ctx, {
      operatoreId: admin._id,
      action: {
        kind: "operatore_reset_inviato",
        name: operatore.name,
        email: operatore.email,
      },
    });
    return accessLinkId;
  },
});

/**
 * An Admin makes an Operatore an Admin, so that the mill is not blocked when
 * the one Admin is away (spec #1, story 46). The Registro row carries the role
 * before and after, because a promotion is a change and the Registro says what
 * changed (ADR-0006).
 *
 * Promoting somebody who is already an Admin is nothing that happened, and
 * writes no row: a second tap on the same button is not a second promotion.
 */
export const promote = mutation({
  args: { operatoreId: v.id("operatori") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const operatore = await requireStaff(ctx, args.operatoreId);
    if (!operatore.active) {
      throw new Error(
        `${operatore.name} is no longer in play: there is nobody to promote.`,
      );
    }
    if (operatore.role === "admin") {
      return null;
    }

    await ctx.db.patch(operatore._id, { role: "admin" });
    await writeRegistroRow(ctx, {
      operatoreId: admin._id,
      action: {
        kind: "operatore_promosso",
        name: operatore.name,
        before: operatore.role,
        after: "admin",
      },
    });
    return null;
  },
});

/**
 * An Admin takes a seasonal Operatore's access away when they leave. They can
 * no longer sign in, and everything they registered stays exactly where it is,
 * still under their name (ADR-0004): a Campagna they worked is not a Campagna
 * with a gap in it.
 *
 * An Admin cannot deactivate themselves. The mill is not left without one by
 * somebody tapping the wrong row, and there is always another Admin to do it
 * to you — which is what promoting a second one is for.
 */
export const deactivate = mutation({
  args: { operatoreId: v.id("operatori") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const operatore = await requireStaff(ctx, args.operatoreId);
    if (operatore._id === admin._id) {
      throw new Error(
        "An Admin cannot deactivate themselves: ask another Admin.",
      );
    }
    if (!operatore.active) {
      return null;
    }

    await ctx.db.patch(operatore._id, { active: false });
    await writeRegistroRow(ctx, {
      operatoreId: admin._id,
      action: { kind: "operatore_disattivato", name: operatore.name },
    });
    return null;
  },
});

/**
 * Whether a Better Auth account still belongs to somebody who works here.
 *
 * Read as a session is being created, which is what turns deactivating an
 * Operatore into their no longer being able to sign in at all (#26) rather
 * than merely into an app that shows them nothing.
 */
export const canSignIn = internalQuery({
  args: { authUserId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const operatore = await ctx.db
      .query("operatori")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", args.authUserId))
      .unique();
    return operatore !== null && operatore.active;
  },
});

/**
 * The moment somebody joins the mill: the invitation is spent and the staff
 * record written, in one transaction, so that a link cannot be followed twice
 * into two accounts.
 *
 * The Registro row is written under the new Operatore, because accepting is
 * something they did and not something the Admin did to them; the Admin's own
 * row went in when they sent the invitation (ADR-0006).
 */
export const join = internalMutation({
  args: { token: v.string(), authUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invitation = await claimInvitation(ctx, args.token);
    const taken = await operatoreAt(ctx, invitation.email);
    if (taken !== null) {
      throw new Error(
        `${taken.name} already holds the account at this address.`,
      );
    }

    const operatoreId = await ctx.db.insert("operatori", {
      authUserId: args.authUserId,
      name: invitation.name,
      email: invitation.email,
      role: invitation.role,
      active: true,
    });
    await writeRegistroRow(ctx, {
      operatoreId,
      action: {
        kind: "invito_accettato",
        name: invitation.name,
        email: invitation.email,
        role: invitation.role,
      },
    });
    return null;
  },
});

/** Whether the mill has any Operatore at all. Guards the seed script. */
export const exists = internalQuery({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const found = await ctx.db.query("operatori").take(1);
    return found.length > 0;
  },
});

/**
 * Attaches a staff record to a Better Auth account. Internal on purpose: an
 * Operatore arrives by seed script or by an Admin's invitation (#26), never by
 * signing themselves up.
 *
 * Writes no Registro row, against ADR-0006: its one caller is the seed script,
 * whose first Admin has no signed-in account to attribute a row to. Everybody
 * who arrives afterwards comes through `join`, which writes theirs.
 */
export const create = internalMutation({
  args: {
    authUserId: v.string(),
    name: v.string(),
    email: v.string(),
    role,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("operatori", { ...args, active: true });
    return null;
  },
});
