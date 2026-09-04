import { v } from "convex/values";
import type { FollowedAccessLink } from "./accessLinks";
import { api, internal } from "./_generated/api";
import { action } from "./_generated/server";
import { createAuth } from "./auth";
import { MIN_PASSWORD_LENGTH } from "./schema";

/**
 * The two things somebody does with a link the mill emailed them: come in for
 * the first time, and choose a new password after forgetting the old one.
 *
 * Both are actions rather than mutations because hashing a password is not
 * something a transaction can do, and both are public and take no signed-in
 * account: whoever follows an invitation has none yet, and whoever has
 * forgotten their password cannot sign in to prove who they are. The link is
 * what stands in for both — good once, and only for the address it went to
 * (ADR-0008).
 */

/** A password the mill will take. Anything shorter is a password in name only. */
function requirePassword(password: string): string {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `A password is at least ${MIN_PASSWORD_LENGTH} characters long.`,
    );
  }
  return password;
}

/**
 * The invited person chooses their password and joins the mill's staff, as the
 * Operatore or the Admin the invitation named.
 *
 * The account is written through the same internals Better Auth's own sign-up
 * route would have used, because that route is off: nobody signs themselves up
 * here, and an invitation is the only way in (ADR-0008).
 *
 * Hands back the address the account answers to, so that the screen can sign
 * the person in with the password they have just chosen rather than asking
 * them to type both again.
 */
export const accept = action({
  args: { token: v.string(), password: v.string() },
  returns: v.object({ email: v.string() }),
  handler: async (ctx, args): Promise<{ email: string }> => {
    requirePassword(args.password);
    // Annotated, like every call these two actions make into the app: the
    // generated `api` carries the type of this file too, and a type that waits
    // on itself is a type TypeScript gives up on and calls `any`.
    const link: FollowedAccessLink | null = await ctx.runQuery(
      api.accessLinks.byToken,
      { token: args.token },
    );
    if (link === null || link.kind !== "invitation") {
      throw new Error("This link is not one the mill sent.");
    }
    if (link.used) {
      throw new Error("This invitation has already been accepted.");
    }
    if (link.expiresAt <= Date.now()) {
      throw new Error("This invitation has expired: ask an Admin for another.");
    }

    const auth = createAuth(ctx);
    const authCtx = await auth.$context;
    if ((await authCtx.internalAdapter.findUserByEmail(link.email)) !== null) {
      throw new Error(`An account already answers to ${link.email}.`);
    }
    const user = await authCtx.internalAdapter.createUser({
      email: link.email,
      name: link.name,
      // The invitation went to this address and came back from it: there is
      // nothing left to verify.
      emailVerified: true,
    });
    try {
      await authCtx.internalAdapter.createAccount({
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: await authCtx.password.hash(args.password),
      });
      // The invitation is spent here, in the same transaction that writes the
      // staff record: two people following one link both get this far, and
      // only one of them comes out of it an Operatore.
      await ctx.runMutation(internal.operatori.join, {
        token: args.token,
        authUserId: user.id,
      });
    } catch (error) {
      // An account with nobody behind it can sign in to nothing (its holder is
      // no Operatore), but it would hold the address against a second, honest
      // invitation. So it goes.
      await authCtx.internalAdapter.deleteUser(user.id);
      throw error;
    }
    return { email: link.email };
  },
});

/**
 * Somebody who forgot their password chooses another, from the link an Admin
 * sent them. The link is spent first and the password set after: a reset that
 * fails halfway leaves the old password standing and the link unusable, which
 * is the safe half to fail on.
 */
export const setPassword = action({
  args: { token: v.string(), password: v.string() },
  returns: v.object({ email: v.string() }),
  handler: async (ctx, args): Promise<{ email: string }> => {
    requirePassword(args.password);
    const { email }: { email: string } = await ctx.runMutation(
      internal.accessLinks.claimReset,
      { token: args.token },
    );

    const auth = createAuth(ctx);
    const authCtx = await auth.$context;
    const found = await authCtx.internalAdapter.findUserByEmail(email);
    if (found === null) {
      throw new Error(`No account answers to ${email}.`);
    }
    await authCtx.internalAdapter.updatePassword(
      found.user.id,
      await authCtx.password.hash(args.password),
    );
    return { email };
  },
});
