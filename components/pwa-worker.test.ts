// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, test, vi } from "vitest";
import { installPlatform } from "@/lib/pwa";

function worker() {
  const listeners: Record<string, (event: unknown) => void> = {};
  const cached = new Map<string, Response>();
  const cache = {
    put: vi.fn(async (key, response) => {
      cached.set(key, response);
    }),
    match: vi.fn(async (key) => cached.get(key)),
  };
  const fetch = vi.fn(async () => new Response("offline page"));
  const skipWaiting = vi.fn();
  const claim = vi.fn();
  const caches = {
    open: vi.fn(async () => cache),
    keys: async () => ["unrelated-cache", "pendolino-offline-old"],
    delete: vi.fn(),
  };
  runInNewContext(
    `const BUILD_ID = "test-build";\n${readFileSync("pwa/worker.js", "utf8")}`,
    {
      self: {
        addEventListener: (
          name: string,
          callback: (event: unknown) => void,
        ) => {
          listeners[name] = callback;
        },
        skipWaiting,
        clients: { claim },
      },
      fetch,
      caches,
      Response,
    },
  );
  return { listeners, cache, fetch, skipWaiting, caches, claim };
}

test("installation caches only the public offline document and waits to activate", async () => {
  const w = worker();
  let installed: Promise<void> | undefined;
  w.listeners.install({
    waitUntil: (promise: Promise<void>) => {
      installed = promise;
    },
  });
  await installed;
  expect(w.cache.put).toHaveBeenCalledWith(
    "/offline.html",
    expect.any(Response),
  );
  expect(w.skipWaiting).not.toHaveBeenCalled();
  w.listeners.message({ data: { type: "APPLY_UPDATE" }, waitUntil: vi.fn() });
  expect(w.skipWaiting).toHaveBeenCalledOnce();
});

test("offline navigations get the fallback; online private pages are never cached", async () => {
  const w = worker();
  await w.cache.put("/offline.html", new Response("offline"));
  const request = {
    mode: "navigate",
    method: "GET",
    url: "https://app.test/ritiro",
  };
  let response: Promise<Response> | undefined;
  const respondWith = (value: Promise<Response>) => {
    response = value;
  };
  w.fetch.mockResolvedValueOnce(new Response("private page"));
  w.listeners.fetch({ request, respondWith });
  expect(await (await response)?.text()).toBe("private page");
  expect(w.cache.put).toHaveBeenCalledTimes(1);
  w.fetch.mockRejectedValueOnce(new Error("offline"));
  w.listeners.fetch({ request, respondWith });
  expect(await (await response)?.text()).toBe("offline");
});

test("worker leaves API requests, mutations and RSC requests alone", () => {
  const w = worker();
  const respondWith = vi.fn();
  for (const request of [
    { method: "POST", mode: "navigate" },
    { method: "GET", mode: "cors" },
  ])
    w.listeners.fetch({ request, respondWith });
  expect(respondWith).not.toHaveBeenCalled();
});

test("activation removes only old Pendolino offline caches", async () => {
  const w = worker();
  let activated: Promise<void> | undefined;
  w.listeners.activate({
    waitUntil: (promise: Promise<void>) => {
      activated = promise;
    },
  });
  await activated;
  expect(w.caches.delete).toHaveBeenCalledExactlyOnceWith(
    "pendolino-offline-old",
  );
  expect(w.claim).toHaveBeenCalledOnce();
});

test("installation instructions distinguish iPad desktop identity and desktop platforms", () => {
  expect(installPlatform("Macintosh Safari", 5)).toBe("ios");
  expect(installPlatform("iPhone", 1)).toBe("ios");
  expect(installPlatform("Android Chrome", 5)).toBe("android");
  expect(installPlatform("Macintosh Safari", 0)).toBe("mac");
  expect(installPlatform("Windows Chrome", 0)).toBe("desktop");
  expect(installPlatform("Linux Chrome", 0)).toBe("desktop");
});
