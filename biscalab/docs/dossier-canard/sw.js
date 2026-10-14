/* Canard BiscaLab — service worker : coquille applicative en cache, réseau d'abord pour index.html. */
const VERSION = 'canard-v1.1.0';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Polices Google : cache après premier chargement (stale-while-revalidate).
  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.open(VERSION).then(async (c) => {
        const cached = await c.match(req);
        const fetching = fetch(req).then((res) => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => cached);
        return cached || fetching;
      })
    );
    return;
  }
  // Même origine : réseau d'abord (toujours la dernière version du dossier), repli cache hors ligne.
  event.respondWith(
    fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
  );
});
