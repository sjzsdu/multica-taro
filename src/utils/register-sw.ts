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
import Taro from '@tarojs/taro'

export function registerServiceWorker(): void {
  if (process.env.TARO_ENV !== 'h5') return
  if (process.env.NODE_ENV !== 'production') return
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  const base = typeof __H5_BASE__ === 'string' && __H5_BASE__ ? __H5_BASE__ : '/'
  const normalized = base.endsWith('/') ? base : `${base}/`

  const promptUpdate = (worker: ServiceWorker | null) => {
    // `controller` is null on the very first install: nothing to update yet.
    if (!worker || !navigator.serviceWorker.controller) return
    void Taro.showModal({
      title: '发现新版本',
      content: '刷新后使用最新版本。',
      confirmText: '刷新',
      cancelText: '稍后',
    }).then((result) => {
      if (!result.confirm) return
      worker.postMessage({ type: 'SKIP_WAITING' })
      window.location.reload()
    })
  }

  const register = () => {
    const scope = new URL(normalized, window.location.origin).href
    navigator.serviceWorker
      .register(`${scope}sw.js`, { scope })
      .then((registration) => {
        if (registration.waiting) promptUpdate(registration.waiting)
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed') promptUpdate(worker)
          })
        })
      })
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
