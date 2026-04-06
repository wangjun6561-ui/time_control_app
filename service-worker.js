const CACHE_NAME = 'taskbox-v1';
const CACHE_FILES = [
  '/', '/index.html', '/css/style.css',
  '/js/app.js', '/js/db.js', '/js/home.js',
  '/js/box-detail.js', '/js/lucky-wheel.js',
  '/js/ai-extract.js', '/js/settings.js',
  '/manifest.json',
  '/assets/sounds/complete.mp3',
  '/assets/sounds/wheel-stop.mp3'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_FILES)));
});

self.addEventListener('fetch', (event) => {
  event.respondWith(caches.match(event.request).then((resp) => resp || fetch(event.request)));
});
