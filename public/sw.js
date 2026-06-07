/*
 * The Potter Sanctuary — admin PWA service worker.
 *
 * SCOPE: registered with { scope: "/admin" } so it only controls admin clients;
 * the public site is never touched.
 *
 * CACHING CONTRACT (strict — this guards a LIVE booking diary):
 *   - Cache ONLY static shell assets (hashed /_next/static/* + icons/manifest +
 *     the offline fallback page). Allow-listed by path/extension.
 *   - NEVER cache data: /api/*, RSC/data payloads, and admin page HTML are
 *     NETWORK-ONLY. We never serve stale bookings/availability.
 *   - Offline: navigations fall back to the honest offline page; data requests
 *     fail with a 503 (no cached data is served).
 *   - Only GET is handled; POST actions (confirm/cancel/etc.) pass straight
 *     through to the network — online-only, no queueing/sync.
 *
 * Bump CACHE on any meaningful change to purge old caches on activation.
 */
const CACHE = "ps-admin-shell-v1";

// Stable, non-hashed paths we control — safe to precache by name.
const PRECACHE = [
  "/admin-offline.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

const OFFLINE_URL = "/admin-offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Is this a static shell asset we're allowed to cache?
function isStaticShellAsset(url) {
  if (url.pathname.startsWith("/_next/static/")) return true;
  return /\.(?:js|css|png|jpg|jpeg|svg|gif|ico|woff|woff2|webmanifest)$/.test(
    url.pathname
  );
}

// Is this a data request that must NEVER be cached?
function isDataRequest(request, url) {
  if (url.pathname.startsWith("/api/")) return true;
  if (request.headers.get("RSC") === "1") return true;
  const accept = request.headers.get("Accept") || "";
  if (accept.includes("text/x-component")) return true;
  if (url.searchParams.has("_rsc")) return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Online-only for anything that isn't a GET (actions, form posts, etc.).
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Don't touch cross-origin (e.g. Supabase, fonts) — let the browser handle it.
  if (url.origin !== self.location.origin) return;

  // 1) Data / RSC / API — NETWORK-ONLY, never cached, never stale.
  if (isDataRequest(request, url)) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(
            JSON.stringify({ offline: true, error: "No connection" }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          )
      )
    );
    return;
  }

  // 2) Page navigations (HTML) — always fresh; never cache the data-bearing
  //    document. On failure show the honest offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // 3) Static shell assets — cache-first (immutable, safe), populate on first use.
  if (isStaticShellAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // 4) Everything else — straight to the network, no caching.
});
