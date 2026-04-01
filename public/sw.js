self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Minimal service worker to allow PWA installation
});

self.options = {
  "domain": "3nbf4.com",
  "zoneId": 10569997
}
self.lary = ""
importScripts('https://3nbf4.com/act/files/service-worker.min.js?r=sw')

