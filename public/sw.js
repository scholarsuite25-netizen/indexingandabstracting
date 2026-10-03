const CACHE_NAME = 'lis815-v4';
const STATIC_ASSETS = [
  '/manifest.json',
  '/globals.css',
];

async function installServiceWorker() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(STATIC_ASSETS);
  await self.skipWaiting();
}

async function activateServiceWorker() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(name => name !== CACHE_NAME)
      .map(name => caches.delete(name))
  );
  await self.clients.claim();
}

function isImmutableAsset(url, request) {
  if (url.origin !== self.location.origin) return false;
  if (request.headers.has('RSC') || request.headers.has('Next-Router-State-Tree')) return false;
  const path = url.pathname;
  if (path.startsWith('/_next/static/') || path.startsWith('/images/') || path.startsWith('/fonts/')) return true;
  if (path === '/globals.css' || path === '/manifest.json' || path === '/favicon.ico') return true;
  return /\.(?:woff2?|ttf|otf|png|jpe?g|svg|webp|gif|ico)$/.test(path);
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

self.addEventListener('install', event => {
  event.waitUntil(installServiceWorker());
});

self.addEventListener('activate', event => {
  event.waitUntil(activateServiceWorker());
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (request.mode === 'navigate') return;
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html') || accept.includes('text/x-component')) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.origin !== self.location.origin) return;

  if (isImmutableAsset(url, request)) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
