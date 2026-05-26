const CACHE_NAME = 'campuscheck-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting(); // Instantly activate the new service worker
});

self.addEventListener('activate', (event) => {
  self.clients.claim(); // Take control of all pages immediately
});

self.addEventListener('fetch', (event) => {
  // Minimal fetch handler required to trigger the "Install PWA" prompt.
  // We use "network-first" to ensure Next.js App Router works perfectly.
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response(
        "Network connection lost. Please check your internet.", 
        { status: 503, statusText: "Service Unavailable" }
      );
    })
  );
});