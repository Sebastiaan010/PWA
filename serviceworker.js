// Versie van je cache - verander dit als je de App Shell wijzigt
const CACHE_VERSION = "app-shell-v1";
const APP_SHELL_CACHE = `cmgt-app-shell-${CACHE_VERSION}`;

// Bestanden die tot je App Shell behoren:
const APP_SHELL_FILES = [
  "/",            // root (werkt meestal op localhost)
  "/index.html",
  "/style.css",
  "/main.js"
  // Later kunnen we hier icons, manifest, etc. aan toevoegen
];

// INSTALL - cache de App Shell
self.addEventListener("install", function (event) {
  console.log("[ServiceWorker] Install");

  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then(function (cache) {
      console.log("[ServiceWorker] Caching app shell");
      return cache.addAll(APP_SHELL_FILES);
    })
  );

  // Nieuwe SW meteen activeren
  self.skipWaiting();
});

// ACTIVATE - oude caches opruimen
self.addEventListener("activate", function (event) {
  console.log("[ServiceWorker] Activate");

  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key.startsWith("cmgt-app-shell-") && key !== APP_SHELL_CACHE) {
            console.log("[ServiceWorker] Verwijder oude cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );

  self.clients.claim();
});

// FETCH - strategie: CacheFirstThenNetwork voor de App Shell
self.addEventListener("fetch", function (event) {
  const request = event.request;
  const url = new URL(request.url);

  // We behandelen alleen GET requests
  if (request.method !== "GET") {
    return;
  }

  // App Shell bestanden -> CacheFirstThenNetwork
  if (APP_SHELL_FILES.includes(url.pathname) || url.pathname === "/") {
    event.respondWith(
      caches.match(request).then(function (cachedResponse) {
        if (cachedResponse) {
          // Uit cache
          return cachedResponse;
        }
        // Niet in cache -> via netwerk ophalen en eventueel bijcachen
        return fetch(request).then(function (networkResponse) {
          return caches.open(APP_SHELL_CACHE).then(function (cache) {
            cache.put(request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Voor nu: alles wat niet App Shell is gewoon doorlaten naar het netwerk
  // (API-calls naar /projects, /tags etc worden later met strategieën afgehandeld)
});
