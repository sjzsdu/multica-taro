/**
 * Registers the H5 service worker in production builds only.
 *
 * Dev uses webpack-dev-server with hot reload; a worker there would serve
 * stale chunks from cache and make debugging confusing.
 *
 * The scope comes from build-time `__H5_BASE__`, not from the manifest
 * `<link href>`: after the SPA pushes a route like /pages/inbox/index, the
 * link's resolved href would point at /pages/inbox/manifest.webmanifest.
 */
export function registerServiceWorker(): void {
  if (process.env.TARO_ENV !== 'h5') return
  if (process.env.NODE_ENV !== 'production') return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  const base = typeof __H5_BASE__ === 'string' && __H5_BASE__ ? __H5_BASE__ : '/'
  const normalized = base.endsWith('/') ? base : `${base}/`

  const register = () => {
    const scope = new URL(normalized, window.location.origin).href
    navigator.serviceWorker
      .register(`${scope}sw.js`, { scope })
      .catch(() => {
        // Offline support is best-effort; the app works without it.
      })
  }

  // Taro mounts the app after `load` in H5, so a plain load listener would
  // never fire. Register immediately once the document is already complete.
  if (document.readyState === 'complete') {
    register()
  } else {
    window.addEventListener('load', register, { once: true })
  }
}
