const CACHE_NAME = 'campuscheck-v1';

// 1. Install the Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // We just cache the root page so it works offline
      return cache.addAll(['/']);
    })
  );
  self.skipWaiting();
});

// 2. Activate and clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Intercept Network Requests (Required for PWA Install Prompt)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      // If the network completely fails, serve from cache
      return caches.match(event.request);
    })
  );
});