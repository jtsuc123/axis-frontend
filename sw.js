const CACHE = 'axis-v1.5'

// ── INSTALL: cache only the app shell ────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // addAll individually so one miss doesn't kill the whole install
      Promise.allSettled([
        c.add('./index.html'),
        c.add('./manifest.json'),
        c.add('./icon-192.png'),
        c.add('./icon-512.png')
      ])
    ).then(() => self.skipWaiting())
  )
})

// ── ACTIVATE: drop old caches ─────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

// ── FETCH ─────────────────────────────────────────────────────
// Rules:
//   • API calls, Supabase, external services → never intercept, pass straight through
//   • Static assets (our own files) → cache-first, network fallback
//   • Navigation (loading the page) → network-first, fall back to cached index.html
self.addEventListener('fetch', e => {
  // Only handle http/https
  if (!e.request.url.startsWith('http')) return

  const url = new URL(e.request.url)

  // Never intercept non-GET or anything not on our own origin
  if (e.request.method !== 'GET') return
  if (url.hostname !== self.location.hostname) return

  // Static assets: cache-first
  if (/\.(png|svg|ico|webp|woff2?|css|js)(\?.*)?$/.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
          return res
        }).catch(() => cached)
      })
    )
    return
  }

  // Navigation (the app shell) or manifest: network-first, cache fallback
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
        return res
      })
      .catch(() =>
        caches.match(e.request).then(r => r || caches.match('/index.html'))
      )
  )
})

// ── PUSH NOTIFICATIONS ────────────────────────────────────────
self.addEventListener('push', function(e) {
  const data = e.data ? e.data.json() : {}
  e.waitUntil(
    self.registration.showNotification(data.title || 'Axis', {
      body:  data.body  || '',
      icon:  './icon-192.png',
      badge: './icon-192.png',
      tag:   data.tag   || 'axis-event'
    })
  )
})

self.addEventListener('notificationclick', function(e) {
  e.notification.close()
  e.waitUntil(clients.openWindow('/'))
})
