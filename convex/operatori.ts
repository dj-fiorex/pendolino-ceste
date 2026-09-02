import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { ruolo } from "./schema";

/**
 * The Operatore signed in on this device, or null when nobody is.
 *
 * Everything the app records is attributed to whoever this returns, so a
 * deactivated Operatore reads as nobody: their account can no longer act,
 * whatever session their device still holds (#26).
 */
export const current = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ nome: v.string(), email: v.string(), ruolo }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }
    const operatore = await ctx.db
      .query("operatori")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", identity.subject))
      .unique();
    if (operatore === null || !operatore.attivo) {
      return null;
    }
    return {
      nome: operatore.nome,
      email: operatore.email,
      ruolo: operatore.ruolo,
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
 * Writes no Registro row, against ADR-0006. The Registro arrives with #27, and
 * the only caller today is the seed script, whose first Admin has no signed-in
 * account to attribute a row to. #26 adds the row when it adds the Admin who
 * does the inviting.
 */
export const create = internalMutation({
  args: {
    authUserId: v.string(),
    nome: v.string(),
    email: v.string(),
    ruolo,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("operatori", { ...args, attivo: true });
    return null;
  },
});
