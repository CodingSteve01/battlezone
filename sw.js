const CACHE_NAME = 'shadow-squad-v1';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/main.js',
  './js/config.js',
  './js/state.js',
  './js/map.js',
  './js/renderer.js',
  './js/combat.js',
  './js/ai.js',
  './js/animations.js',
  './js/events.js',
  './js/particles.js',
  './js/renderTerrain.js',
  './js/renderUtils.js',
  './js/renderVegetation.js',
  './js/ui.js',
  './js/assetLoader.js',
  './js/fogOfWar.js',
  './js/pathfinding.js',
  './js/hexMath.js',
  './js/pixiRenderer.js',
  './js/assets.js',
  './js/audio.js',
  './js/input.js',
  './js/powerups.js',
  './js/progression.js',
  './js/turns.js',
  './js/units.js',
  './icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;

  if (isSameOrigin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        return fetch(request).then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match('./index.html'))
  );
});
