/* BUILD_ID is prepended by the static /sw.js route at build time. */
const CACHE = `pendolino-offline-${BUILD_ID}`;
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      const response = await fetch(OFFLINE, { cache: "reload" });
      if (!response.ok) throw new Error("Offline page unavailable");
      await cache.put(OFFLINE, response);
    }),
  );
  // Updates wait. An active page must explicitly ask to apply one.
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "APPLY_UPDATE") {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("pendolino-offline-") && key !== CACHE) {
          await caches.delete(key);
        }
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  // Never cache authenticated HTML, API responses, mutations or Next RSC data.
  if (event.request.method !== "GET" || event.request.mode !== "navigate")
    return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(OFFLINE)) ?? Response.error();
    }),
  );
});
