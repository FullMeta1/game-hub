'use strict';
const CACHE = 'fenghuo-v2-static-1';
const ASSETS = ['./', './index.html', './style.css', '../fenghuo/style.css', './manifest.webmanifest', '../fenghuo/icon.svg', '../fenghuo/icon-192.png', '../fenghuo/icon-512.png', './src/data.mjs', './src/game.mjs', './src/cards.mjs', './src/turns.mjs', './src/skills.mjs', './src/ai.mjs', './src/storage.mjs', './src/ui.mjs'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('fenghuo-v2-static-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
    return response;
  }).catch(async () => (await caches.match(event.request)) || (event.request.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
