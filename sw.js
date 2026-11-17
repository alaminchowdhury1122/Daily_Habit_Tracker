// Habit Tracker service worker. Bump V when you want every device to drop its old cache.
const V = 'ht-v2';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'logo.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  const own = u.origin === self.location.origin;
  const font = /(^|\.)(fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname);
  // Only the app itself and its fonts. Apps Script / Drive sync calls always go straight to the network.
  if (!own && !font) return;

  if (r.mode === 'navigate') {
    // Online: always the newest index.html. Offline: the saved copy.
    e.respondWith(
      fetch(r).then(res => {
        const copy = res.clone();
        caches.open(V).then(c => c.put('index.html', copy));
        return res;
      }).catch(() => caches.match('index.html'))
    );
    return;
  }
  // Everything else: show the saved copy fast, refresh it in the background.
  e.respondWith(
    caches.open(V).then(c => c.match(r).then(hit => {
      const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }))
  );
});
