import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import { api } from "@/convex/_generated/api";

export const { handler, isAuthenticated, getToken, fetchAuthQuery } =
  convexBetterAuthNextJs({
    convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
    convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL!,
  });

/**
 * Who is on this device: whether there is a session at all, and the Operatore
 * behind it. The two are not the same — an account the mill has deactivated
 * still holds a session, and no longer has an Operatore.
 */
export async function signedInOperatore() {
  if (!(await isAuthenticated())) {
    return { signedIn: false, operatore: null } as const;
  }
  return {
    signedIn: true,
    operatore: await fetchAuthQuery(api.operatori.current, {}),
  } as const;
}
