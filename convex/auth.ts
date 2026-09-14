import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { makeFunctionReference } from "convex/server";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";

const ONE_DAY_IN_SECONDS = 60 * 60 * 24;

/**
 * A session lasts a whole Campagna — October to March — so that a password is
 * typed once at the opening and not again until spring, including on a device
 * shared by the whole mill (ADR-0008). A lost phone is handled by deactivating
 * that Operatore, not by a short session.
 */
const SESSION_LIFETIME_IN_SECONDS = 180 * ONE_DAY_IN_SECONDS;

export const authComponent = createClient<DataModel>(components.betterAuth);

/**
 * `internal.operatori.canSignIn`, named rather than imported.
 *
 * The generated `internal` object carries the type of every module in the app,
 * and two of those modules are built on this file — the actions that open an
 * account and set its password. Importing it here would make this file's type
 * depend on itself, and TypeScript answers a cycle with `any`, quietly, across
 * the whole app. The name is the one the generated object would have handed
 * over, and the tests that sign somebody in are what keep the two in step.
 */
const canSignIn = makeFunctionReference<
  "query",
  { authUserId: string },
  boolean
>("operatori:canSignIn");

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: process.env.SITE_URL,
    // Additional frontend origins sharing this backend, such as a Vercel preview.
    trustedOrigins: process.env.AUTH_TRUSTED_ORIGINS?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      // Accounts are created by the seed script and, later, by an Admin's
      // invitation (#26). Nobody signs themselves up: the sign-up route is off.
      disableSignUp: true,
      requireEmailVerification: false,
    },
    session: {
      expiresIn: SESSION_LIFETIME_IN_SECONDS,
      // Every day of use pushes the expiry back out to the full lifetime, so a
      // device in daily service at the counter never reaches it.
      updateAge: ONE_DAY_IN_SECONDS,
    },
    databaseHooks: {
      session: {
        create: {
          /**
           * An account the mill has deactivated gets no session, which is what
           * makes deactivating an Operatore the end of their signing in and
           * not merely the start of an app that shows them nothing (#26).
           *
           * Roles and the active flag are the app's own and live on the staff
           * record rather than in the auth provider (ADR-0008), so this is
           * where the two meet: Better Auth has just checked the password, and
           * the app says whether the person behind it still works here.
           */
          before: async (session) => {
            const allowed = await ctx.runQuery(canSignIn, {
              authUserId: session.userId,
            });
            // `false` is what aborts the session; anything else lets it
            // through, so the refusal has to be exactly this.
            return allowed ? undefined : false;
          },
        },
      },
    },
    plugins: [convex({ authConfig })],
  });
