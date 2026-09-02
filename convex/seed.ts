import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { createAuth } from "./auth";

/**
 * Creates the mill's first Admin, the one account that cannot be invited by
 * somebody else. Run it once against a fresh deployment:
 *
 * ```bash
 * npx convex run seed:createFirstAdmin '{"nome":"Gabriele","email":"gabriele@example.com","password":"..."}'
 * ```
 *
 * There is no public registration route, so this is the only way in until an
 * Admin exists to invite the rest of the staff (#26).
 */
export const createFirstAdmin = internalAction({
  args: {
    nome: v.string(),
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
      name: args.nome,
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
      nome: args.nome,
      email: args.email,
      ruolo: "admin",
    });

    return { authUserId: user.id };
  },
});
