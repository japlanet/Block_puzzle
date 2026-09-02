// Service worker: makes the game fully playable offline.
//
// Strategy: on install, precache every file the game needs (app shell, levels,
// fonts, icons). On fetch, serve from the cache first and fall back to the
// network; navigations that miss the cache fall back to index.html so the app
// always opens offline. Bump CACHE_VERSION whenever you deploy a change — the
// old cache is deleted on activate and the page reloads itself (see main.js).

const CACHE_VERSION = 'animal-escape-v3';
const ASSETS = [
  './',
  './index.html',
  './editor.html',
  './manifest.webmanifest',
  './css/style.css',
  './css/editor.css',
  './fonts/fredoka-latin.woff2',
  './fonts/fredoka-latin-ext.woff2',
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
  './js/editor/main.js',
  './js/editor/state.js',
  './js/editor/render.js',
  './js/editor/tools.js',
  './js/editor/input.js',
  './js/editor/export.js',
  './data/levels.json',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      // Fetch fresh copies (bypass the HTTP cache) so a version bump really
      // picks up the new files. Don't fail install if one optional asset is
      // missing (e.g. icons not yet generated).
      return Promise.all(ASSETS.map(url =>
        cache.add(new Request(url, { cache: 'reload' }))
          .catch(err => console.warn('[sw] could not cache', url, err))
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
  // Only handle our own origin (leave analytics, extensions, etc. alone).
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    // ignoreSearch: "index.html?test=1" (editor test-play) still hits the cache.
    caches.match(req, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (!res || res.status !== 200 || res.type !== 'basic') return res;
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => {
        // Offline and not cached: for page loads, open the game shell.
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
