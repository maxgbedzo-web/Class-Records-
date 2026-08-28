// Bump this on every deploy that changes cached files, so old caches get cleared.
const CACHE_NAME = "learner-records-v1";

// App shell: everything needed to boot the UI with no network.
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/app.js",
  "./js/auth.js",
  "./js/db.js",
  "./js/firebase-config.js",
  "./js/router.js",
  "./js/utils.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

// Firebase SDK is loaded from a CDN. We cache it opaquely (no-cors) so the
// app can still boot — and thus reach Firestore's own offline cache — when
// the device has no connection.
const CDN_URLS = [
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);
      // Best-effort: don't fail install if the CDN is unreachable at build time.
      await Promise.all(
        CDN_URLS.map(async (url) => {
          try {
            const req = new Request(url, { mode: "no-cors" });
            const res = await fetch(req);
            await cache.put(req, res);
          } catch (err) {
            // Will retry via the fetch handler's cache-and-network logic later.
          }
        })
      );
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      );
      self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Never intercept Firestore/Auth's own network traffic — let it hit the
  // network directly (or fail) so the Firestore SDK's own offline queue
  // handles retries correctly.
  if (
    request.url.includes("firestore.googleapis.com") ||
    request.url.includes("identitytoolkit.googleapis.com") ||
    request.url.includes("securetoken.googleapis.com")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          return fresh;
        } catch (err) {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match("./index.html")) || Response.error();
        }
      })()
    );
    return;
  }

  // Cache-first for everything else in the app shell / CDN list.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        cache.put(request, fresh.clone());
        return fresh;
      } catch (err) {
        return cached || Response.error();
      }
    })()
  );
});
