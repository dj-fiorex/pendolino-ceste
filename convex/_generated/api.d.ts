/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accessLinks from "../accessLinks.js";
import type * as accounts from "../accounts.js";
import type * as auth from "../auth.js";
import type * as campagne from "../campagne.js";
import type * as ceste from "../ceste.js";
import type * as clienti from "../clienti.js";
import type * as email from "../email.js";
import type * as etichette from "../etichette.js";
import type * as http from "../http.js";
import type * as movimenti from "../movimenti.js";
import type * as operatori from "../operatori.js";
import type * as recupero from "../recupero.js";
import type * as registro from "../registro.js";
import type * as seed from "../seed.js";
import type * as settings from "../settings.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accessLinks: typeof accessLinks;
  accounts: typeof accounts;
  auth: typeof auth;
  campagne: typeof campagne;
  ceste: typeof ceste;
  clienti: typeof clienti;
  email: typeof email;
  etichette: typeof etichette;
  http: typeof http;
  movimenti: typeof movimenti;
  operatori: typeof operatori;
  recupero: typeof recupero;
  registro: typeof registro;
  seed: typeof seed;
  settings: typeof settings;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
