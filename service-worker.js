// v3 - Updated API caching to network-first for data freshness

const STATIC_CACHE_NAME = 'limperial-static-cache-v3';
const DYNAMIC_CACHE_NAME = 'limperial-dynamic-cache-v3';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  // Note: index.tsx and other bundled assets are typically handled by the build process
  // and might have hashed names. For this setup, we assume they are covered by runtime caching.
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  'https://rsms.me/inter/inter.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log('Precaching static assets');
      return cache.addAll(STATIC_ASSETS).catch(error => {
        console.error('Failed to cache static assets:', error);
      });
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

const handleApiFetch = (event) => {
  event.respondWith(
    caches.open(DYNAMIC_CACHE_NAME).then(async (cache) => {
      try {
        const networkResponse = await fetch(event.request);
        // Do not cache POST requests as they modify data
        if (event.request.method !== 'POST') {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        // For GET requests, try to serve from cache if network fails
        if (event.request.method === 'GET') {
            const cachedResponse = await cache.match(event.request);
            if (cachedResponse) {
                return cachedResponse;
            }
        }
        // For non-GET requests or if not in cache, re-throw the network error
        console.error('Fetch failed; returning offline response or error.', error);
        return new Response(JSON.stringify({ error: 'Offline and no cached data available.' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503,
          statusText: 'Service Unavailable'
        });
      }
    })
  );
};

const handleOtherFetch = (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            return fetch(event.request).then((networkResponse) => {
                // Check if we received a valid response
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }
                
                return caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
                    if (event.request.method !== 'POST') { // Don't cache POST
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                });
            });
        })
    );
};


self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin === 'https://script.google.com') {
    return handleApiFetch(event);
  }

  // Use a cache-first strategy for other requests (assets, CDNs, etc.)
  return handleOtherFetch(event);
});
