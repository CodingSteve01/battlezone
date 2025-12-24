// Cache version - will be replaced by build process with actual version/hash
const CACHE_VERSION = '__BUILD_HASH__';
const CACHE_NAME = `shadow-squad-${CACHE_VERSION}`;

// Files to precache (will be updated by build process)
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg'
];

// Install: precache essential files
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version: ${CACHE_VERSION}`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => {
        console.log('[SW] Precache complete');
        // Force activation without waiting for old SW to finish
        return self.skipWaiting();
      })
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating version: ${CACHE_VERSION}`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('shadow-squad-') && name !== CACHE_NAME)
          .map((name) => {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Claiming clients');
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

// Fetch: network-first for HTML, cache-first for hashed assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);

  // Only handle same-origin requests
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // Determine caching strategy based on file type
  const isHTML = request.destination === 'document' ||
                 requestUrl.pathname.endsWith('.html') ||
                 requestUrl.pathname === '/' ||
                 requestUrl.pathname.endsWith('/');

  // Check if asset has hash in filename (Vite bundled assets)
  const isHashedAsset = /\.[a-f0-9]{8}\.(js|css|png|jpg|svg|woff2?)$/i.test(requestUrl.pathname);

  if (isHTML) {
    // Network-first for HTML - always try to get latest version
    event.respondWith(networkFirst(request));
  } else if (isHashedAsset) {
    // Cache-first for hashed assets - they're immutable
    event.respondWith(cacheFirst(request));
  } else {
    // Stale-while-revalidate for other assets
    event.respondWith(staleWhileRevalidate(request));
  }
});

// Network-first strategy: try network, fall back to cache
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    // Cache the fresh response
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // If no cache, try the root for navigation requests
    if (request.destination === 'document') {
      return caches.match('./index.html');
    }
    throw error;
  }
}

// Cache-first strategy: use cache if available, otherwise fetch
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const networkResponse = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, networkResponse.clone());
  return networkResponse;
}

// Stale-while-revalidate: return cache immediately, update in background
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await caches.match(request);

  // Fetch in background
  const fetchPromise = fetch(request).then((networkResponse) => {
    cache.put(request, networkResponse.clone());
    return networkResponse;
  }).catch(() => null);

  // Return cached response immediately if available, otherwise wait for network
  return cachedResponse || fetchPromise;
}

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }

  // Force update check
  if (event.data === 'checkUpdate') {
    self.registration.update();
  }
});
