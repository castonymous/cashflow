const CACHE_NAME = 'cashflow-v3';
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/data.js',
    '/app.js',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
    'https://cdn.jsdelivr.net/npm/remixicon@4.2.0/fonts/remixicon.css'
];

self.addEventListener('install', (event) => {
    self.skipWaiting(); // Force update immediately
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // Network-First Strategy
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // Return fresh network response, optionally we could cache it here
                return networkResponse;
            })
            .catch(() => {
                // If offline or network fails, fallback to cache
                return caches.match(event.request);
            })
    );
});
