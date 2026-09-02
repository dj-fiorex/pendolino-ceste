import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
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

export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: process.env.SITE_URL,
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
    plugins: [convex({ authConfig })],
  });
