import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    // Convex functions run in a V8 isolate, not in Node: `edge-runtime` is the
    // closest thing Vitest offers.
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts", "components/**/*.test.ts"],
    server: {
      deps: {
        inline: ["convex-test", "@convex-dev/better-auth"],
      },
    },
    env: {
      SITE_URL: "http://localhost:3000",
      CONVEX_SITE_URL: "https://test.convex.site",
      BETTER_AUTH_SECRET: "test-only-secret",
    },
  },
});
