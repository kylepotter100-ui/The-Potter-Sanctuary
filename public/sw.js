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
const CACHE = "ps-admin-shell-v2";

const OFFLINE_URL = "/admin-offline.html";

// Stable, non-hashed static assets — safe to precache by name. These are never
// returned for a navigation, so a redirect flag on them is harmless: plain addAll.
const PRECACHE = [
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

// Rebuild a guaranteed NON-redirected 200 HTML Response. A Response built via
// `new Response(body, ...)` always has `redirected === false` (the flag cannot be
// set), so this is what makes the offline page safe to return for a navigation —
// a service worker may not return a redirected/3xx response to a navigate request
// (Safari rejects it: "response served by service worker has redirections").
async function toCleanHtmlResponse(res) {
  const body = await res.blob();
  return new Response(body, {
    status: 200,
    statusText: "OK",
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "text/html; charset=utf-8",
    },
  });
}

// Precache the offline page as a clean 200, never a redirect. We follow redirects
// while fetching, then store a reconstructed (non-redirected) copy.
async function precacheOfflinePage(cache) {
  const res = await fetch(OFFLINE_URL, { redirect: "follow", cache: "reload" });
  const clean = res.redirected || res.status !== 200 ? await toCleanHtmlResponse(res) : res;
  await cache.put(OFFLINE_URL, clean);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.all([cache.addAll(PRECACHE), precacheOfflinePage(cache)]);
    })
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
  //    document. On failure serve the honest offline page as a clean, NON-redirected
  //    200 (returning a redirected/3xx response here triggers the Safari error
  //    "response served by service worker has redirections").
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cached = await caches.match(OFFLINE_URL);
          if (cached && !cached.redirected) return cached;
          if (cached) return toCleanHtmlResponse(cached);
          // Last-resort inline fallback if the precache is somehow missing.
          return new Response(
            "<!doctype html><meta charset=utf-8><title>Offline</title><p>You're offline.",
            { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        }
      })()
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
