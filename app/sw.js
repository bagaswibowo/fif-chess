/*
 * app/sw.js (V8 — ui-parity-v2, PWA-lite)
 * Service worker vanilla tanpa dependency.
 * Strategi: network-first dgn cache fallback untuk navigasi & shell statis;
 * request API (/api/) TIDAK pernah di-cache. Halaman yang pernah dibuka
 * tetap tampil sebagai shell saat offline + banner offline dari layout.
 */

const CACHE_NAME = "jev-chess-shell-v1";
const PRECACHE = ["/", "/manifest.webmanifest", "/icons/app-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // API dinamis TIDAK di-cache — selalu jaringan, tanpa fallback cache.
  if (url.pathname.startsWith("/api/")) return;

  // Network-first dengan cache fallback (navigasi & aset statis).
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then(
          (cached) =>
            cached ||
            caches.match("/").then((shell) => shell || Response.error()),
        ),
      ),
  );
});
