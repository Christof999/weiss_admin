/* eslint-disable no-undef */
/**
 * Service Worker der Admin-PWA.
 *  1. Web Push  – zeigt Benachrichtigungen auch bei geschlossener App (über
 *     den Browser-Push-Dienst; serverseitig via web-push/VAPID ausgelöst).
 *  2. App-Shell-Caching – Grundgerüst offline verfügbar.
 *
 * Kein Firebase im Service Worker nötig – reines natives Web Push.
 */

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'Neue Anfrage', body: event.data ? event.data.text() : '' }
  }

  const title = payload.title || 'Weiß Forst – Neue Anfrage'
  const options = {
    body: payload.body || 'Es ist eine neue Anfrage eingegangen.',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/icon-192.png',
    tag: payload.tag || 'neue-anfrage',
    renotify: true,
    data: { url: payload.url || '/anfragen' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/anfragen'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate?.(targetUrl)
          return client.focus()
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(targetUrl) : null
    }),
  )
})

/* ───────────── App-Shell-Caching (best effort) ───────────── */
const CACHE = 'forst-admin-shell-v2'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.png']

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(SHELL.map((url) => cache.add(url).catch(() => {}))),
    ),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return // API nie cachen

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html').then((r) => r || caches.match('/')),
      ),
    )
    return
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request)
          .then((resp) => {
            if (resp && resp.status === 200 && resp.type === 'basic') {
              const clone = resp.clone()
              caches.open(CACHE).then((c) => c.put(request, clone))
            }
            return resp
          })
          .catch(() => cached),
    ),
  )
})
