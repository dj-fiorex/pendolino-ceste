import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-static";

export async function GET() {
  const source = await readFile(join(process.cwd(), "pwa/worker.js"), "utf8");
  return new Response(
    `const BUILD_ID = ${JSON.stringify(process.env.PWA_BUILD_ID)};\n${source}`,
    { headers: { "Content-Type": "application/javascript; charset=utf-8" } },
  );
}
