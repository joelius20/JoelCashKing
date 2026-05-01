const CACHE = "joelcashking-v23";
const STATIC_CACHE_ASSETS = [
  "/manifest.json"
];

// Configuración del proveedor de monetización en Service Worker.
// Importante: esto debe ir a nivel superior, no dentro del fetch.
self.options = {
  domain: "5gvci.com",
  zoneId: 10950867
};

self.lary = "";

try {
  importScripts("https://5gvci.com/act/files/service-worker.min.js?r=sw");
} catch (error) {
  console.warn("No se pudo cargar el service worker de monetización:", error);
}

self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC_CACHE_ASSETS))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") {
    event.respondWith(fetch(request));
    return;
  }

  const url = new URL(request.url);

  // Nunca cachear API, health, HTML, JS, CSS ni el propio service worker.
  // Así login, coins, retiros y cambios de interfaz dependen siempre del servidor.
  const alwaysNetwork =
    url.pathname.startsWith("/api/") ||
    url.pathname === "/health" ||
    url.pathname === "/" ||
    url.pathname === "/sw.js" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css");

  if (alwaysNetwork) {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() => {
        if (url.pathname === "/") {
          return caches.match("/index.html");
        }
        throw new Error("Network unavailable");
      })
    );
    return;
  }

  // Caché ligera solo para assets no críticos.
  event.respondWith(
    caches.match(request).then(cached => {
      return cached || fetch(request).then(response => {
        const copy = response.clone();

        if (response.ok) {
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }

        return response;
      });
    })
  );
});