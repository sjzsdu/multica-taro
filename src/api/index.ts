import Taro from '@tarojs/taro'
import { ApiClient } from './client'

const DEFAULT_ORIGIN = 'https://multica.wnbgj.com'

/**
 * H5 uses a same-origin prefix so deployments can reverse-proxy `/api` and
 * `/auth` to the Multica backend (the upstream does not send CORS headers for
 * arbitrary origins). Native shells have no origin to proxy through, so they
 * talk to the configured API origin directly.
 *
 * Set `TARO_APP_API_BASE` at build time to override (e.g. a staging host).
 */
function resolveBaseUrl(): string {
  const configured = typeof __API_BASE_URL__ === 'string' ? __API_BASE_URL__ : ''
  if (configured) return configured
  return process.env.TARO_ENV === 'h5' ? '' : DEFAULT_ORIGIN
}

/** Exposed for Taro.uploadFile, which takes a URL instead of using the client. */
export function getApiBaseUrl(): string {
  return resolveBaseUrl()
}

let client: ApiClient | null = null
let unauthorizedHandler: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

export function getApiClient(): ApiClient {
  if (!client) {
    client = new ApiClient({
      baseUrl: resolveBaseUrl(),
      getToken: () => (Taro.getStorageSync('auth_token') as string) || null,
      getWorkspaceSlug: () => (Taro.getStorageSync('workspace_slug') as string) || null,
      onUnauthorized: () => unauthorizedHandler?.(),
    })
  }
  return client
}

/** Drops the memoized client after the token or workspace changed. */
export function resetApiClient(): void {
  client = null
}

export * from './client'
export * from './types'
