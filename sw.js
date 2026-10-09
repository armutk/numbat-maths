// Offline-first service worker: precache the app shell, serve from cache, refresh in the background.
const VERSION = 'numbat-maths-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js', './js/ui.js', './js/art.js', './js/audio.js', './js/speech.js', './js/drag.js', './js/store.js', './js/parent.js',
  './js/modules/sharing.js', './js/modules/groups.js', './js/modules/numbers.js', './js/modules/addsub.js',
  './assets/fonts/Fredoka-latin.woff2', './assets/fonts/Nunito-latin.woff2',
  './assets/icons/icon.svg', './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/icon-512-maskable.png', './assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const fetching = fetch(req).then((res) => {
        if (res && res.ok) caches.open(VERSION).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => cached);
      if (cached) return cached;
      return fetching.catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()));
    })
  );
});
