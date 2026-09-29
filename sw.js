// RSTI Study — Service Worker
// Estrategia: network-first con respaldo en caché (así funciona sin conexión).
// Al cambiar archivos de la app, sube CACHE_NAME para que los celulares descarguen la versión nueva.

const CACHE_NAME = 'rsti-study-v4';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './css/styles.css',
  './data/rsti.js',
  './data/dev.js',
  './js/main.js',
  './js/actions.js',
  './js/ai.js',
  './js/bank.js',
  './js/progress.js',
  './js/pwa.js',
  './js/router.js',
  './js/state.js',
  './js/storage.js',
  './js/study-routes.js',
  './js/ui.js',
  './js/util.js',
  './js/views/aplicar.js',
  './js/views/exam.js',
  './js/views/flashcards.js',
  './js/views/home.js',
  './js/views/module.js',
  './js/views/quiz.js',
  './js/views/search.js',
  './js/views/stats.js',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Cachea lo que exista; si algún archivo falta, no rompe la instalación.
      Promise.all(PRECACHE_URLS.map((url) => cache.add(url).catch(() => null)))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Solo archivos de la propia app; las llamadas a otras páginas (p.ej. la API de Gemini) pasan directo.
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Solo se guardan respuestas correctas: un 404 en caché rompería el modo sin conexión.
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Al abrir la app sin conexión desde otra URL, sirve la página principal cacheada.
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html').then((idx) => idx || caches.match('./'));
          }
          return undefined;
        })
      )
  );
});
