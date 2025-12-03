importScripts("/localforage.min.js");

// Config
const CACHE_VERSION = "app-shell-v1";
const APP_SHELL_CACHE = `cmgt-app-shell-${CACHE_VERSION}`;

const APP_SHELL_FILES = [
  "/",
  "/index.html",
  "/style.css",
  "/main.js"
];

const REMOTE_API_BASE = "https://cmgt.hr.nl/api";

// localForage configureren voor projecten
localforage.config({
  name: "cmgt-pwa",
  storeName: "projects-store" // elk project in aparte rij
});

// Helpers voor IndexedDB
function storeProjectsFromApiData(apiData) {
  if (!apiData || !Array.isArray(apiData.data)) {
    return Promise.resolve();
  }

  const ops = apiData.data.map(function (item) {
    const project = item.project;
    if (!project || !project.slug) {
      return Promise.resolve();
    }
    const key = "project-" + project.slug;
    return localforage.setItem(key, project);
  });

  return Promise.all(ops);
}

function buildProjectsResponseFromIndexedDB() {
  return localforage.keys().then(function (keys) {
    const projectKeys = keys.filter(function (key) {
      return key.startsWith("project-");
    });

    if (projectKeys.length === 0) {
      const empty = { data: [] };
      return new Response(JSON.stringify(empty), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return Promise.all(
      projectKeys.map(function (key) {
        return localforage.getItem(key);
      })
    ).then(function (projects) {
      const payload = {
        data: projects.map(function (project) {
          return { project: project };
        })
      };

      return new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json" }
      });
    });
  });
}

// INSTALL - App Shell cachen
self.addEventListener("install", function (event) {
  console.log("[ServiceWorker] Install");

  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then(function (cache) {
      console.log("[ServiceWorker] Caching app shell");
      return cache.addAll(APP_SHELL_FILES);
    })
  );

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

// FETCH
self.addEventListener("fetch", function (event) {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") {
    return;
  }

  // Op de shell is Cache first strategie gebruikt.
  if (APP_SHELL_FILES.includes(url.pathname) || url.pathname === "/") {
    event.respondWith(
      caches.match(request).then(function (cachedResponse) {
        if (cachedResponse) {
          return cachedResponse;
        }

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

  // 2) Tags -> Network Only met offline fallback-JSON
  if (url.pathname.startsWith("/api/tags")) {
    event.respondWith(
      fetch(REMOTE_API_BASE + "/tags" + url.search).catch(function () {
        console.log(
          "[ServiceWorker] NetworkOnly: tags kunnen niet worden geladen (offline)"
        );
        const payload = {
          offline: true,
          message: "Tags kunnen niet geladen worden omdat je offline bent."
        };
        return new Response(JSON.stringify(payload), {
          headers: { "Content-Type": "application/json" }
        });
      })
    );
    return;
  }

  // Net work first strategie toegepast, deze laad eerst via het internet daarna uit de IndexedDB/
  if (url.pathname.startsWith("/api/projects")) {
    event.respondWith(
      fetch(REMOTE_API_BASE + "/projects" + url.search)
        .then(function (networkResponse) {
          const clone = networkResponse.clone();

          clone
            .json()
            .then(function (data) {
              return storeProjectsFromApiData(data);
            })
            .catch(function (err) {
              console.warn("[ServiceWorker] Kon projectdata niet parsen:", err);
            });

          return networkResponse;
        })
        .catch(function () {
          console.log(
            "[ServiceWorker] NetworkFirst: netwerk faalt, haal projecten uit IndexedDB"
          );
          return buildProjectsResponseFromIndexedDB();
        })
    );
    return;
  }

  // 4) Alles anders gewoon door naar netwerk
});
