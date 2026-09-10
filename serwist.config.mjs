import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { serwist } from "@serwist/next/config";

export default serwist({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  precachePrerendered: false,
  // An allowlist keeps pages, RSC responses, and future public exports out.
  globPatterns: [
    ".next/static/**/*.{js,css,woff2}",
    "public/{icon-192,icon-512,icon-maskable-512,apple-touch-icon}.png",
  ],
  additionalPrecacheEntries: [
    {
      url: "/offline.html",
      revision: createHash("sha256")
        .update(readFileSync("public/offline.html"))
        .digest("hex"),
    },
  ],
});
