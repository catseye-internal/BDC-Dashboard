// BDC Dashboard Service Worker — stale-while-revalidate for cache.json
const CACHE_NAME = 'bdc-v1';
const CACHE_JSON = 'cache.json';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only intercept cache.json requests (strip query params for matching)
  if (!url.pathname.endsWith('/' + CACHE_JSON) && !url.pathname.endsWith(CACHE_JSON)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(CACHE_JSON);

      // Always fetch fresh in background
      const fetchPromise = fetch(event.request).then(resp => {
        if (resp.ok) cache.put(CACHE_JSON, resp.clone());
        return resp;
      }).catch(() => null);

      // Return cached immediately if available, otherwise wait for network
      if (cached) {
        // Fire-and-forget: update cache in background
        fetchPromise;
        return cached;
      }

      // No cache — must wait for network
      const networkResp = await fetchPromise;
      return networkResp || new Response('{}', { status: 503 });
    })
  );
});
