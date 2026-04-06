const CACHE = 'axis-v1.2'

const CORE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
]

// ── INSTALL: cache core shell ─────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())
  )
})

// ── ACTIVATE: drop old caches ─────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// ── FETCH: network-first, fall back to cache ──────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // Only handle GET; skip API calls (backend + Supabase + CDN)
  if (e.request.method !== 'GET') return
  if (url.hostname.includes('onrender.com'))  return
  if (url.hostname.includes('supabase.co'))   return
  if (url.hostname.includes('googleapis.com') && !url.pathname.includes('css')) return
  if (url.hostname.includes('cdnjs.cloudflare.com')) {
    // Cache-first for CDN scripts
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
        return res
      }))
    )
    return
  }

  // Network-first for everything else (app shell, fonts)
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
      icon:  '/icon-192.png',
      badge: '/icon-192.png',
      tag:   data.tag   || 'axis-event'
    })
  )
})

self.addEventListener('notificationclick', function(e) {
  e.notification.close()
  e.waitUntil(clients.openWindow('/'))
})
