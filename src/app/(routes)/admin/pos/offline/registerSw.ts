// Register public/sw.js from the POS page only (production builds), then hand
// it the files this page already loaded so the screen opens offline next time
// (the first visit loads them before the service worker is in control).
'use client';

let done = false;

export function registerPosServiceWorker() {
  if (done || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  if (process.env.NODE_ENV !== 'production') return;
  done = true;
  // Ask the browser to keep this site's saved data for good, so sales waiting
  // to upload are never cleared to free disk space.
  navigator.storage?.persist?.().catch(() => undefined);
  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then(() => navigator.serviceWorker.ready)
    .then((reg) => {
      const urls = performance
        .getEntriesByType('resource')
        .map((e) => e.name)
        .filter((u) => {
          try {
            const url = new URL(u);
            return url.origin === location.origin && (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/images/'));
          } catch {
            return false;
          }
        });
      urls.push('/manifest.webmanifest', '/apple-touch-icon.png', '/images/logo.png');
      reg.active?.postMessage({ type: 'CACHE_URLS', urls, page: '/admin/pos' });
    })
    .catch((e) => console.error('Service worker not registered:', e));
}
