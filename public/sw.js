// public/sw.js
const CACHE_NAME = 'campuscheck-v7'; // Bumped version to force an update
const STATIC_ASSETS = [
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Install event: Cache the essential shell
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
  self.clients.claim(); // Take control of all clients immediately
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

// Fetch event: The Caching Strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. BYPASS API ROUTES & SUPABASE (Never cache dynamic data)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
    return; // Let the browser handle it normally
  }

  // 2. CACHE-FIRST FOR STATIC ASSETS (JS, CSS, Images, Fonts)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(png|svg|woff2|css|js)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        
        return fetch(event.request).then((response) => {
          // Only cache successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        });
      })
    );
    return;
  }

  // 3. NETWORK-FIRST WITH CACHE FALLBACK FOR PAGES (HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // If network is successful, cache a copy of the HTML page
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails (offline), try to return the cached page
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            
            // If the page isn't in cache, fallback to the offline UI (or home)
            return caches.match('/');
          });
        })
    );
    return;
  }
});

// Listen for Push Notifications
self.addEventListener('push', function(event) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        vibrate: [100, 50, 100],
        data: {
          url: data.url || '/student-hub'
        }
      };
      event.waitUntil(
        self.registration.showNotification(data.title, options)
      );
    } catch (e) {
      console.error('Push data error', e);
    }
  }
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;
  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((windowClients) => {
    let matchingClient = null;
    for (let i = 0; i < windowClients.length; i++) {
      const windowClient = windowClients[i];
      if (windowClient.url === urlToOpen) {
        matchingClient = windowClient;
        break;
      }
    }
    if (matchingClient) {
      return matchingClient.focus();
    } else {
      return clients.openWindow(urlToOpen);
    }
  });
  event.waitUntil(promiseChain);
});