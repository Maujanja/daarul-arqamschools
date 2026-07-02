function isOldAppCache(name) {
  return (
    name.startsWith("daarul-arqam-") ||
    /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name)
  );
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.allSettled(cacheNames.filter(isOldAppCache).map((name) => caches.delete(name)));
      } finally {
        await self.registration.unregister();
      }
    })()
  );
});