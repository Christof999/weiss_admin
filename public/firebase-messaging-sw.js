/* eslint-disable no-undef */
/**
 * Service Worker der Admin-PWA.
 * Übernimmt ZWEI Aufgaben in einem File (gemeinsamer Scope "/"):
 *   1. Firebase Cloud Messaging – Background-Push, wenn die App geschlossen ist.
 *   2. App-Shell-Caching – Grundgerüst offline verfügbar.
 *
 * Die Firebase-Werte werden über die URL-Query an den SW übergeben
 * (?apiKey=…&projectId=…&senderId=…&appId=…), da ein SW nicht auf
 * import.meta.env zugreifen kann. Siehe registerMessagingServiceWorker().
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js')

const params = new URL(self.location).searchParams
const firebaseConfig = {
  apiKey: params.get('apiKey') || '',
  authDomain: params.get('authDomain') || '',
  projectId: params.get('projectId') || '',
  storageBucket: params.get('storageBucket') || '',
  messagingSenderId: params.get('senderId') || '',
  appId: params.get('appId') || '',
}

if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  try {
    firebase.initializeApp(firebaseConfig)
    const messaging = firebase.messaging()

    messaging.onBackgroundMessage((payload) => {
      const title =
        (payload.notification && payload.notification.title) || 'Neue Anfrage'
      const body =
        (payload.notification && payload.notification.body) ||
        'Es ist eine neue Anfrage eingegangen.'
      self.registration.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'neue-anfrage',
        data: { url: (payload.data && payload.data.url) || '/anfragen' },
      })
    })
  } catch (e) {
    // Messaging nicht verfügbar – SW funktioniert trotzdem für Caching
  }
}

// Klick auf eine Push-Notification öffnet/fokussiert die App
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/anfragen'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if ('focus' in win) {
          win.navigate?.(target)
          return win.focus()
        }
      }
      return clients.openWindow(target)
    }),
  )
})

/* ───────────── App-Shell-Caching (best effort) ───────────── */
const CACHE = 'forst-admin-shell-v1'
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
  if (url.origin !== self.location.origin) return // keine Cross-Origin/API-Anfragen cachen

  // Navigationsanfragen: Netzwerk zuerst, Fallback auf App-Shell (SPA)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    )
    return
  }

  // Statische Assets: Cache zuerst, dann Netzwerk
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
