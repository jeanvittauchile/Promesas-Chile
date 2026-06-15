const CACHE = 'pcn-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.open(CACHE).then(cache =>
      fetch(request)
        .then(res => { cache.put(request, res.clone()); return res; })
        .catch(() => cache.match(request))
    )
  );
});
