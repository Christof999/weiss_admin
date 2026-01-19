const CACHE_NAME = 'weiss-forst-admin-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/auth.js',
  '/config.js',
  '/manifest.json',
  '/pwa.js',
  '/admin.html',
  '/admin.js',
  '/admin_styles.css',
  '/logo.jpeg',
  '/icons/icon-120.png',
  '/icons/icon-152.png',
  '/icons/icon-167.png',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/admin_anfragen.html',
  '/admin_anfragen.js',
  '/admin_beitrag.html',
  '/beitraege.html',
  '/admin_galerie.html',
  '/admin_posts.js',
  '/login_styles.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Service Worker Installation
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // WICHTIG: addAll bricht komplett ab, wenn nur eine Datei 404t.
        // Für lokale Entwicklung (config.js fehlt oft) und robuste PWA-Installationen
        // cachen wir daher best-effort.
        return Promise.all(
          ASSETS_TO_CACHE.map((asset) =>
            cache.add(asset).catch((err) => {
              // bewusst nicht failen
              console.warn('[SW] Cache add failed:', asset, err);
            })
          )
        );
      })
  );
});

// Service Worker Activation
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((cacheName) => {
          return cacheName !== CACHE_NAME;
        }).map((cacheName) => {
          return caches.delete(cacheName);
        })
      );
    })
  );
});

// Fetch Event Strategy
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return the response from the cached version
        if (response) {
          return response;
        }
        
        // Not in cache - return the result from the live server
        // and cache it for future
        return fetch(event.request)
          .then((response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response as it's a stream
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
              
            return response;
          });
      })
  );
});
