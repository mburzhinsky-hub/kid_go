/* КидГоу service worker: офлайн-оболочка + кэш просмотренных страниц и фото.
   Стратегии: страницы — network-first (свежие данные, офлайн — из кэша),
   статика и изображения — stale-while-revalidate. */
const VERSION = "kidgo-collections-20261006-v3";
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const SHELL = ["/", "/adventures/", "/favorites/", "/offline.html", "/icons/icon-192.png"].map((p) => BASE + p);

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("kidgo-") && k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // /import несёт в адресе личные хотелки — не кэшируем
  if (url.pathname.startsWith(BASE + "/api/") || url.pathname.startsWith(BASE + "/admin") || url.pathname.startsWith(BASE + "/import")) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match(BASE + "/offline.html")))
    );
    return;
  }

  const isAsset = url.pathname.startsWith(BASE + "/_next/static") || url.pathname.startsWith(BASE + "/icons") || url.hostname === "images.unsplash.com";
  if (isAsset) {
    e.respondWith(
      caches.open(VERSION).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req)
          .then((res) => {
            if (res.ok || res.type === "opaque") c.put(req, res.clone());
            return res;
          })
          .catch(() => hit);
        return hit || net;
      })
    );
  }
});
