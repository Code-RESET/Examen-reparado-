// RSTI Study — Service Worker
// Estrategia: network-first con fallback a caché (cache-first para offline real).
// No requiere conocer el nombre exacto del archivo HTML: cachea todo lo que se pida.

const CACHE_NAME = 'rsti-study-v2';
const PRECACHE_URLS = [
  './',
  './index.html',
  './data.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cachea lo que exista; si algún archivo no está (ej. nombre distinto), no rompe la instalación.
      return Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch(() => null)
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Si es una navegación (abrir la app) y no hay caché de esa URL exacta,
          // intenta servir la página principal cacheada.
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html').then((idx) => idx || caches.match('./'));
          }
          return undefined;
        })
      )
  );
});
