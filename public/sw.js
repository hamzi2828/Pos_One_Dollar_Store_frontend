/* DOLLAR & Co POS service worker (hand-written, no libraries).
 *
 * Goal: the POS screen (/admin/pos) opens and works with no internet.
 *  - Pages under /admin/pos: network first, cached copy when offline.
 *  - /_next/static/*: cache first (file names change with every build).
 *  - Images: stale-while-revalidate.
 *  - API calls (/api, the backend host) and anything else: never cached,
 *    the browser handles them as usual.
 * Registered only from the POS page (offline/registerSw.ts).
 */
const VERSION = 'v1';
const PAGE_CACHE = `pos-pages-${VERSION}`;
const STATIC_CACHE = `pos-static-${VERSION}`;
const IMAGE_CACHE = `pos-images-${VERSION}`;
const KEEP = [PAGE_CACHE, STATIC_CACHE, IMAGE_CACHE];
const IMAGE_LIMIT = 400;
const POS_PATH = '/admin/pos';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((c) => c.addAll(['/manifest.webmanifest', '/apple-touch-icon.png', '/images/logo.png']).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pos-') && !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const isPosPage = (url) => url.pathname === POS_PATH || url.pathname.startsWith(POS_PATH + '/');

/** Only a real, good page goes in the cache (not a redirect to sign-in). */
const cacheablePage = (res) => res && res.ok && res.type === 'basic' && !res.redirected;

async function pageNetworkFirst(request, url) {
  const cache = await caches.open(PAGE_CACHE);
  // One copy per path (the ?tab=... query does not change the HTML).
  const key = url.origin + url.pathname;
  try {
    const res = await fetch(request);
    if (cacheablePage(res)) await cache.put(key, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(key, { ignoreVary: true });
    if (hit) return hit;
    // Another POS page (e.g. an invoice) never opened before: say so plainly.
    return new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>No internet</title><body style="font-family:system-ui,sans-serif;padding:24px;text-align:center">' +
        '<h1 style="font-size:20px">No internet</h1><p>This page needs internet.</p>' +
        '<p><a href="/admin/pos">Back to the POS</a> (sales still work offline).</p></body>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

async function staticCacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && res.ok) cache.put(request, res.clone()).catch(() => undefined);
  return res;
}

async function trimCache(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function imageStaleWhileRevalidate(event, request) {
  const cache = await caches.open(IMAGE_CACHE);
  const hit = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      // ok, or opaque (cross-origin image without CORS) — both can be shown.
      if (res && (res.ok || res.type === 'opaque')) {
        cache
          .put(request, res.clone())
          .then(() => trimCache(IMAGE_CACHE, IMAGE_LIMIT))
          .catch(() => undefined);
      }
      return res;
    })
    .catch(() => undefined);
  if (hit) {
    event.waitUntil(network);
    return hit;
  }
  const res = await network;
  return res || new Response('', { status: 504 });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  const sameOrigin = url.origin === self.location.origin;

  // Never cache API calls.
  if (sameOrigin && url.pathname.startsWith('/api')) return;

  if (request.mode === 'navigate') {
    if (sameOrigin && isPosPage(url)) event.respondWith(pageNetworkFirst(request, url));
    return;
  }

  if (sameOrigin && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(staticCacheFirst(request));
    return;
  }

  // Next.js RSC / data requests and everything cross-origin that is not an image: browser default.
  if (request.destination === 'image' || (sameOrigin && url.pathname.startsWith('/_next/image'))) {
    // Cross-origin images only (product photos); never backend API JSON.
    event.respondWith(imageStaleWhileRevalidate(event, request));
  }
});

// The POS page sends the files it already loaded (first visit) + the page itself.
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type !== 'CACHE_URLS') return;
  event.waitUntil(
    (async () => {
      const urls = Array.isArray(data.urls) ? data.urls.slice(0, 500) : [];
      const cache = await caches.open(STATIC_CACHE);
      await Promise.all(
        urls.map(async (u) => {
          try {
            const url = new URL(u, self.location.origin);
            if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) return;
            if (await cache.match(url.href)) return;
            const res = await fetch(url.href, { credentials: 'same-origin' });
            if (res.ok) await cache.put(url.href, res);
          } catch {
            /* offline or gone: skip */
          }
        })
      );
      if (data.page === POS_PATH) {
        try {
          const res = await fetch(POS_PATH, { credentials: 'same-origin' });
          if (cacheablePage(res)) {
            const pages = await caches.open(PAGE_CACHE);
            await pages.put(self.location.origin + POS_PATH, res);
          }
        } catch {
          /* offline */
        }
      }
    })()
  );
});
