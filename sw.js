// Service worker: cache-first with versioned cache.
// Bump CACHE_VERSION whenever you deploy a change to force a refresh.

const CACHE_VERSION = 'animal-escape-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/main.js',
  './js/state.js',
  './js/levels.js',
  './js/geometry.js',
  './js/solver.js',
  './js/hint.js',
  './js/audio.js',
  './js/render.js',
  './js/input.js',
  './js/effects.js',
  './js/ui.js',
  './data/levels.json',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      // Don't fail install if some optional asset (e.g. icons not yet generated) is missing.
      return Promise.all(ASSETS.map(url =>
        cache.add(url).catch(err => console.warn('[sw] could not cache', url, err))
      ));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        // Only cache same-origin responses of OK status.
        if (!res || res.status !== 200 || res.type !== 'basic') return res;
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => cached); // offline fallback
    })
  );
});
