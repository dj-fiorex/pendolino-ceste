import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  query,
  type QueryCtx,
} from "./_generated/server";
import { role } from "./schema";

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
  const identity = await ctx.auth.getUserIdentity();
  if (identity === null) {
    return null;
  }
  const operatore = await ctx.db
    .query("operatori")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", identity.subject))
    .unique();
  if (operatore === null || !operatore.active) {
    return null;
  }
  return operatore;
}

/** The same, for the functions that have nothing to say to a stranger. */
export async function requireOperatore(
  ctx: QueryCtx,
): Promise<Doc<"operatori">> {
  const operatore = await currentOperatore(ctx);
  if (operatore === null) {
    throw new Error("No Operatore is signed in on this device.");
  }
  return operatore;
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
 * Writes no Registro row, against ADR-0006: the only caller today is the seed
 * script, whose first Admin has no signed-in account to attribute a row to.
 * #26 adds the row when it adds the Admin who does the inviting.
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
