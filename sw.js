/* UwatchMe service worker. Bump VERSION on every release so phones pick up the new files. */
const VERSION = 'uwatchme-v1';
const SHELL = [
  '/', '/index.html', '/css/style.css',
  '/js/i18n.js', '/js/core.js', '/js/ui.js', '/js/views.js', '/js/detail.js', '/js/app.js',
  '/manifest.webmanifest', '/icons/mark.svg', '/icons/icon-192.png'
];
const DATA = VERSION + '-data';
const ASSETS = VERSION + '-assets';
const ASSET_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'image.tmdb.org'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(req) {
  const cache = await caches.open(DATA);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req);
    return hit || new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req, { ignoreSearch: true });
  const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
  if (hit) return hit;
  const res = await net;
  if (res) return res;
  if (req.mode === 'navigate') { const shell = await cache.match('/index.html'); if (shell) return shell; }
  return new Response('', { status: 504 });
}

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function cacheFirst(req) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') { cache.put(req, res.clone()); trim(cache, 400); }
    return res;
  } catch (e) {
    return new Response('', { status: 504 });
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (url.pathname === '/admin.html' || url.pathname === '/js/admin.js') return;
    if (url.pathname.startsWith('/api/') || url.pathname === '/catalog.json') { e.respondWith(networkFirst(req)); return; }
    e.respondWith(staleWhileRevalidate(req));
    return;
  }
  if (ASSET_HOSTS.includes(url.hostname)) e.respondWith(cacheFirst(req));
  // Everything else (YouTube, archive.org video) goes straight to the network.
});
