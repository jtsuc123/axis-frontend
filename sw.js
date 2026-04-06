self.addEventListener('push', function(e) {
  const data = e.data ? e.data.json() : {}
  e.waitUntil(
    self.registration.showNotification(data.title || 'Axis', {
      body:  data.body  || '',
      icon:  '/favicon.ico',
      badge: '/favicon.ico',
      tag:   data.tag   || 'axis-event'
    })
  )
})

self.addEventListener('notificationclick', function(e) {
  e.notification.close()
  e.waitUntil(clients.openWindow('/'))
})
