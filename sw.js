const CACHE_NAME = 'cashflow-v2';
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
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Return cache or fetch new from network, but fetch anew if not in cache
                return response || fetch(event.request);
            })
    );
});
