// Bump VERSION whenever you change index.html to force installed copies to update.
const VERSION = 'v1';
const CACHE = `crypto-tracker-${VERSION}`;
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const LIBS = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(SHELL);
    await Promise.all(LIBS.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.hostname.endsWith('binance.com') || url.hostname.endsWith('binance.vision')) return; // live market data is never cached

  if (req.mode === 'navigate') { // network first (3s), fall back to cached app
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const res = await Promise.race([fetch(req), new Promise((_, r) => setTimeout(r, 3000))]);
        if (res.ok) c.put('./index.html', res.clone());
        return res;
      } catch { return (await c.match('./index.html')) || Response.error(); }
    })());
    return;
  }

  if (url.origin === location.origin || url.hostname === 'cdn.jsdelivr.net') { // cache first, fill on miss
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    })());
  }
});
