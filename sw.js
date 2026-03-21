/* ═══════════════════════════════════════════
   Elaborate Service Worker v3
   Network-first for HTML — always fresh
   Cache-first only for fonts/images/icons
═══════════════════════════════════════════ */

const CACHE_VERSION = 'elaborate-v3';

const STATIC_ASSETS = [
  '/favicon.png',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(c => c.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (e.request.method !== 'GET') return;

  // Never intercept Firebase / Google auth / API calls
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('firebase') ||
    url.includes('googleapis.com/identitytoolkit') ||
    url.includes('googleapis.com/securetoken') ||
    url.includes('gstatic.com/firebasejs')
  ) return;

  const isHTML = e.request.mode === 'navigate' || url.endsWith('.html');
  const isFont = url.includes('fonts.gstatic.com') || url.includes('fonts.googleapis.com');
  const isImage = /\.(png|jpg|jpeg|svg|ico|webp)(\?|$)/.test(url);

  if (isHTML) {
    // Network-first: always fetch fresh, fall back to cache when offline
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) caches.open(CACHE_VERSION).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  if (isFont || isImage) {
    // Cache-first: static assets never change
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE_VERSION).then(c => c.put(e.request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // Everything else (JS inline in HTML, manifest etc): network-first
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) caches.open(CACHE_VERSION).then(c => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
