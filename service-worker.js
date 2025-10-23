// v4 - Improved SPA navigation and added more icons to cache

const STATIC_CACHE_NAME = 'limperial-static-cache-v4';
const DYNAMIC_CACHE_NAME = 'limperial-dynamic-cache-v4';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/icons/maskable_icon_x512.png',
  'https://rsms.me/inter/inter.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('Precaching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).catch(error => {
      console.error('Failed to pre-cache static assets:', error);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys
        .filter(key => key !== STATIC_CACHE_NAME && key !== DYNAMIC_CACHE_NAME)
        .map(key => caches.delete(key))
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests: Network-first with cache fallback for GET
  if (url.origin === 'https://script.google.com') {
    event.respondWith(
      caches.open(DYNAMIC_CACHE_NAME).then(async (cache) => {
        try {
          const networkResponse = await fetch(request);
          if (request.method === 'GET' && networkResponse.ok) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (error) {
          if (request.method === 'GET') {
            const cachedResponse = await cache.match(request);
            if (cachedResponse) return cachedResponse;
          }
          console.error('API fetch failed:', error);
          return new Response(JSON.stringify({ error: 'Offline and no cached data available.' }), {
            headers: { 'Content-Type': 'application/json' }, status: 503, statusText: 'Service Unavailable'
          });
        }
      })
    );
    return;
  }

  // Navigation requests: Serve the app shell (index.html) from cache.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then(response => {
        return response || fetch('/index.html');
      })
    );
    return;
  }

  // Other assets: Cache-first strategy.
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      return cachedResponse || fetch(request).then(networkResponse => {
        return caches.open(DYNAMIC_CACHE_NAME).then(cache => {
          // Only cache successful GET requests
          if (request.method === 'GET' && networkResponse.ok) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        });
      });
    })
  );
});