import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Convex functions run in a V8 isolate, not in Node: `edge-runtime` is the
    // closest thing Vitest offers.
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
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
