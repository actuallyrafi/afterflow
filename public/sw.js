/* Afterflow service worker (v4.1c, D21). Keeps the app's static files and the public app shell so
 * the home-screen app reopens fast. It never stores API responses, your own pages (/m/*, which carry
 * your private key, and your per-user manifest under /m/{token}/), connection or card links, or
 * anything that isn't a plain same-origin GET. Rules mirror lib/pwa.ts (swMayCache); lib/pwa.test.ts checks both. */
const VERSION = "afterflow-v41h-1";
const STATIC = `${VERSION}-static`;
const SHELL = `${VERSION}-shell`;
const NEVER = ["/api/", "/m/", "/c/", "/meet/", "/survey", "/organiser", "/join/", "/demo", "/deleted"];
const STATIC_PREFIXES = ["/_next/static/", "/icons/"];
const SHELL_PATHS = ["/", "/how-we-built"];

function mayCache(url, method) {
  if (method !== "GET") return null;
  const path = url.pathname;
  if (NEVER.some((prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix))) return null;
  if (STATIC_PREFIXES.some((prefix) => path.startsWith(prefix))) return "static";
  if (SHELL_PATHS.includes(path) && !url.search) return "shell";
  return null;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(["/", "/icons/icon-192.png"]))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Next.js client navigations (RSC payloads) and prefetches always go to the network.
  if (request.headers.get("RSC") || request.headers.get("Next-Router-Prefetch")) return;
  const kind = mayCache(url, request.method);
  if (!kind) return; // Not ours to keep: the browser handles it as if there were no service worker.

  if (kind === "static") {
    // Hashed, immutable files: cache first.
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok && response.type === "basic") cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  // App shell pages: network first, the saved copy only when offline.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => (await caches.match(request)) || Response.error()),
  );
});
