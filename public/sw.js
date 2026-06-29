const CACHE_NAME = "rooc-archive-cache-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/icon.svg",
  "/manifest.json"
];

// Install Service Worker and cache essential assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching app shell and icons...");
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Service Worker and clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("[Service Worker] Clearing old cache...", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch handler - cache first with network fallback
self.addEventListener("fetch", (event) => {
  // Only handle GET requests and skip firestore/gemini API calls to prevent errors
  if (event.request.method !== "GET" || event.request.url.includes("firestore") || event.request.url.includes("googleapis")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // Return response if it's not a valid or secure request to cache
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        // Dynamically cache other matching app shell requests
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Fallback or quiet failure when offline and item is not cached
        return new Response("Offline content unavailable", {
          status: 503,
          statusText: "Service Unavailable"
        });
      });
    })
  );
});
