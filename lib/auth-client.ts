import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Talks to Better Auth through this app's own `/api/auth` route, which proxies
 * to the Convex deployment and carries the session cookie on this domain.
 */
export const authClient = createAuthClient({
  plugins: [convexClient()],
});
