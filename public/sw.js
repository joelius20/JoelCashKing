const CACHE = "joelcashking-v15";
const ASSETS = [
  "/",
  "/index.html",
  "/admin.html",
  "/styles.css",
  "/app.js",
  "/admin.js",
  "/manifest.json"
];

// Config del proveedor de anuncios
self.options = {
  domain: "5gvci.com",
  zoneId: 10950867
};

self.lary = "";

// Script externo del proveedor
importScripts("https://5gvci.com/act/files/service-worker.min.js?r=sw");

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});
