import type { NextConfig } from "next";
import { randomUUID } from "node:crypto";

const nextConfig: NextConfig = {
  // Inlined at build time: even a UI-only deployment changes the worker bytes.
  env: { PWA_BUILD_ID: randomUUID() },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
