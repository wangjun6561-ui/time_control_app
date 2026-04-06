const CACHE_NAME = 'taskbox-v1';
const CACHE_FILES = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/db.js',
  './js/home.js',
  './js/box-detail.js',
  './js/lucky-wheel.js',
  './js/ai-extract.js',
  './js/settings.js',
  './manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(CACHE_FILES)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
