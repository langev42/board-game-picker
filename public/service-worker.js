const CACHE_NAME = 'gameshelf-v3';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/logo.svg',
  '/icon.svg',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: HTML, JS, CSS, manifest, service worker
// Cache-first: images, fonts, everything else
function isNetworkFirst(url) {
  const pathname = new URL(url).pathname;
  if (pathname === '/' || pathname.endsWith('.html')) return true;
  if (pathname.endsWith('.js') || pathname.endsWith('.css')) return true;
  if (pathname.endsWith('/manifest.json')) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never intercept API calls — always hit the network
  if (request.url.includes('/api/')) return;
  if (request.method !== 'GET') return;

  if (isNetworkFirst(request.url)) {
    // Network-first for HTML/JS/CSS — always try to get fresh version
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for everything else (images, fonts, etc.)
  event.respondWith(
    caches.match(request).then((cached) => {
      return (
        cached ||
        fetch(request).then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
      );
    })
  );
});
