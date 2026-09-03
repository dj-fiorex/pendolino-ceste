import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { createAuth } from "./auth";

/**
 * Creates the mill's first Admin, the one account that cannot be invited by
 * somebody else. Run it once against a fresh deployment:
 *
 * ```bash
 * npx convex run seed:createFirstAdmin '{"name":"Gabriele","email":"gabriele@example.com","password":"..."}'
 * ```
 *
 * There is no public registration route, so this is the only way in until an
 * Admin exists to invite the rest of the staff (#26).
 */
export const createFirstAdmin = internalAction({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
  },
  returns: v.object({ authUserId: v.string() }),
  handler: async (ctx, args) => {
    if (await ctx.runQuery(internal.operatori.exists, {})) {
      throw new Error(
        "This deployment already has an Operatore. Invite further staff from the app instead.",
      );
    }

    // Better Auth's sign-up route is off, so the account is written through the
    // same internals that route would have used: a user, and a credential
    // account carrying the hashed password.
    const auth = createAuth(ctx);
    const authCtx = await auth.$context;
    const user = await authCtx.internalAdapter.createUser({
      email: args.email,
      name: args.name,
      emailVerified: true,
    });
    await authCtx.internalAdapter.createAccount({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: await authCtx.password.hash(args.password),
    });

    await ctx.runMutation(internal.operatori.create, {
      authUserId: user.id,
      name: args.name,
      email: args.email,
      role: "admin",
    });

    return { authUserId: user.id };
  },
});

/**
 * Sets an existing account's password, for a deployment somebody has to be able
 * to sign in to and nobody can:
 *
 * ```bash
 * npx convex run seed:setPassword \
 *   '{"email":"gabriele@frantoio.example","password":"..."}'
 * ```
 *
 * A scrypt hash gives nothing back, so a dev deployment whose one Admin was
 * seeded months ago is otherwise a deployment with no way in. Internal, so it
 * is reachable only by whoever can already deploy — and it is not the reset the
 * mill uses, which an Admin sends by email and which is #26's (ADR-0008).
 */
export const setPassword = internalAction({
  args: { email: v.string(), password: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const auth = createAuth(ctx);
    const authCtx = await auth.$context;
    const found = await authCtx.internalAdapter.findUserByEmail(args.email);
    if (found === null) {
      throw new Error(`No account answers to ${args.email}.`);
    }
    await authCtx.internalAdapter.updatePassword(
      found.user.id,
      await authCtx.password.hash(args.password),
    );
    return null;
  },
});
