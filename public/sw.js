const CACHE_NAME = 'campuscheck-v4';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Install: cache only the images
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate: nuke all old caches
self.addEventListener('activate', (event) => {
  self.clients.claim();
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch: Network-first for EVERYTHING. Do not intercept navigations.
self.addEventListener('fetch', (event) => {
  // Only cache images/fonts/CSS/JS. Never cache HTML routes.
  const url = new URL(event.request.url);
  const isStaticAsset = url.pathname.match(/\.(png|svg|woff2|css|js)$/);

  if (isStaticAsset && event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || fetch(event.request).then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        });
      })
    );
  }
  // For everything else (HTML, API), let the browser fetch it normally from the network.
});