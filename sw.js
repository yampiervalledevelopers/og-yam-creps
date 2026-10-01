const cacheName = 'ogyamcreps-v1';

self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
});

self.addEventListener('fetch', (e) => {
  // Pass-through fetch to satisfy PWA requirements
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
