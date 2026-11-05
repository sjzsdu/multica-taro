/** Error raised for a non-2xx response (or a transport failure). */
export class ApiError extends Error {
  status: number
  statusText: string
  body?: unknown

  constructor(status: number, statusText: string, body?: unknown, message?: string) {
    super(message || extractServerMessage(body) || (status === 0 ? '网络连接失败' : `${status} ${statusText || '请求失败'}`))
    this.name = 'ApiError'
    this.status = status
    this.statusText = statusText
    this.body = body
  }
}

function extractServerMessage(body: unknown): string | undefined {
  if (!body || typeof body !== 'object') return undefined
  const record = body as Record<string, unknown>
  for (const key of ['error', 'message', 'detail']) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

export interface ApiClientOptions {
  baseUrl: string
  getToken: () => string | null
  getWorkspaceSlug?: () => string | null
  onUnauthorized?: () => void
}

const FETCH_TIMEOUT_MS = 30_000

function generateRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

type QueryValue = string | number | boolean | undefined | null

function buildQuery(params?: Record<string, QueryValue | QueryValue[]>): string {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    if (Array.isArray(value)) {
      const joined = value.filter((v) => v !== undefined && v !== null && v !== '').join(',')
      if (joined) search.set(key, joined)
      continue
    }
    search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export class ApiClient {
  private baseUrl: string
  private options: ApiClientOptions

  constructor(options: ApiClientOptions) {
    this.options = options
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Client-Platform': process.env.TARO_ENV === 'h5' ? 'web' : process.env.TARO_ENV || 'mobile',
      'X-Client-Version': '0.1.0',
      'X-Request-ID': generateRequestId(),
    }

    const token = this.options.getToken()
    if (token) headers.Authorization = `Bearer ${token}`

    // Multica resolves the active workspace from this header. Without it,
    // workspace-scoped endpoints answer 400 rather than guessing.
    const slug = this.options.getWorkspaceSlug?.()
    if (slug) headers['X-Workspace-Slug'] = slug

    return { ...headers, ...extra }
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: init.signal ?? controller.signal,
        headers: this.headers(init.headers as Record<string, string> | undefined),
      })

      if (response.status === 401) {
        this.options.onUnauthorized?.()
      }

      return response
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ApiError(0, 'Request timeout', undefined, '请求超时，请稍后重试')
      }
      if (err instanceof Error) {
        throw new ApiError(0, 'Network error', undefined, err.message)
      }
      throw err
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async raw(path: string, init?: RequestInit): Promise<Response> {
    return this.request(path, init)
  }

  async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.request(path, init)

    if (response.status === 204) {
      return undefined as T
    }

    const text = await response.text()
    let body: unknown = undefined
    if (text) {
      try {
        body = JSON.parse(text)
      } catch {
        body = text
      }
    }

    if (!response.ok) {
      throw new ApiError(response.status, response.statusText, body)
    }

    return body as T
  }

  get<T>(path: string, params?: Record<string, QueryValue | QueryValue[]>): Promise<T> {
    return this.fetch<T>(`${path}${buildQuery(params)}`)
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.fetch<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.fetch<T>(path, {
      method: 'PUT',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.fetch<T>(path, {
      method: 'PATCH',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }

  delete<T>(path: string): Promise<T> {
    return this.fetch<T>(path, { method: 'DELETE' })
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return '未知错误'
}
