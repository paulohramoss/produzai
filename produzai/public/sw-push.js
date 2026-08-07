// Service Worker: push + periodic sync + notification click
// Loaded via importScripts() from the Workbox-generated SW.

self.addEventListener('push', function (event) {
  var data = {}
  try { data = event.data.json() } catch (e) {}
  var title = data.title || '⚡ Rise Plan'
  var body  = data.body  || 'Hora de verificar seus hábitos!'
  event.waitUntil(
    self.registration.showNotification(title, {
      body:      body,
      icon:      '/favicon.svg',
      badge:     '/favicon.svg',
      tag:       'rise-push',
      renotify:  true,
      data:      data,
    })
  )
})

// Periodic Background Sync — Chrome 80+ / Android
// The browser wakes the SW roughly every minInterval ms and fires this.
self.addEventListener('periodicsync', function (event) {
  if (event.tag === 'rise-daily-reminder') {
    event.waitUntil(
      self.registration.showNotification('⚡ Rise Plan', {
        body:  'Hora de verificar seus hábitos e treino do dia!',
        icon:  '/favicon.svg',
        badge: '/favicon.svg',
        tag:   'rise-daily',
        data:  { url: '/' },
      })
    )
  }
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  var url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var client = list[i]
        if ('focus' in client) {
          // Só focar perderia o destino: a notificação aponta para uma página
          // específica (plano, treino, insights), então navega antes de focar.
          if ('navigate' in client) {
            return client.navigate(url).then(function (c) { return (c || client).focus() })
          }
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
