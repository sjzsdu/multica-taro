/*
 * Multica H5 service worker.
 *
 * Scope is the directory the worker is served from, so the same file works on
 * the root domain and on a sub-path deployment. API traffic is deliberately
 * never cached: the inbox and issue lists must always reflect the server.
 *
 * Bump CACHE_VERSION when the caching strategy changes; a byte change in this
 * file is also what makes browsers pick the new worker up.
 */
const CACHE_VERSION = 'v1'
const SHELL_CACHE = `multica-shell-${CACHE_VERSION}`
const ASSET_CACHE = `multica-assets-${CACHE_VERSION}`

const scopeUrl = new URL('./', self.location.href)
const indexUrl = new URL('index.html', scopeUrl).href
const SHELL_URLS = [scopeUrl.href, indexUrl, new URL('manifest.webmanifest', scopeUrl).href]

const IMAGE_RE = /\.(?:png|jpe?g|gif|svg|ico|webp|woff2?)$/
const CODE_RE = /\.(?:js|css)$/

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response && response.ok) {
      const key = fallbackUrl || request
      cache.put(key, response.clone()).catch(() => {})
    }
    return response
  } catch (error) {
    const cached = await cache.match(fallbackUrl || request)
    if (cached) return cached
    throw error
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response && response.ok) {
    cache.put(request, response.clone()).catch(() => {})
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Never serve cached auth/API responses or intercept the socket.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname === '/ws'
  ) {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE, indexUrl))
    return
  }

  if (IMAGE_RE.test(url.pathname)) {
    event.respondWith(cacheFirst(request))
    return
  }

  if (CODE_RE.test(url.pathname)) {
    event.respondWith(networkFirst(request, ASSET_CACHE))
  }
})
