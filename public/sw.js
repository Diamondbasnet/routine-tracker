/* TR-1 service worker: cache app shell so it works offline */
const CACHE = "tr1-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// network-first for navigation (so updates arrive), cache-first for assets
self.addEventListener("fetch", e => {
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("./index.html")));
  } else {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
  }
});
