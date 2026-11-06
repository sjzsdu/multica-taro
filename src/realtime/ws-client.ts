/**
 * Minimal Multica realtime client for H5.
 *
 * Protocol (matching the web/desktop client and server/internal/realtime):
 *   - connect to `<api-origin>/ws?workspace_slug=...&client_platform=h5`
 *   - the token is sent as the first frame, never in the URL
 *   - server replies `auth_ack` on success, `auth_error` and closes otherwise
 *
 * Reconnects with exponential backoff + jitter and stops after an auth error;
 * a token refresh or workspace switch rebuilds the client from the bridge.
 */
export interface WSMessage {
  type: string
  payload?: unknown
  actor_id?: string
  actor_type?: string
}

export type RealtimeStatus = 'connecting' | 'connected' | 'disconnected' | 'unauthorized'

export interface RealtimeClientOptions {
  token: string
  workspaceSlug: string
  onMessage: (message: WSMessage) => void
  onStatus?: (status: RealtimeStatus) => void
}

const RECONNECT_BASE_MS = 1_000
const RECONNECT_MAX_MS = 30_000

function resolveBaseUrl(): string {
  const configured = typeof __API_BASE_URL__ === 'string' ? __API_BASE_URL__ : ''
  if (configured) {
    const url = new URL(configured)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    url.pathname = '/ws'
    url.search = ''
    url.hash = ''
    return url.toString()
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws`
}

export class RealtimeClient {
  private ws: WebSocket | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private attempt = 0
  private stopped = false
  private readonly url: string

  constructor(private readonly options: RealtimeClientOptions) {
    const url = new URL(resolveBaseUrl())
    url.searchParams.set('workspace_slug', options.workspaceSlug)
    url.searchParams.set('client_platform', 'h5')
    url.searchParams.set('client_version', '0.1.0')
    this.url = url.toString()
  }

  connect(): void {
    if (this.stopped) return

    this.options.onStatus?.('connecting')
    let socket: WebSocket
    try {
      socket = new WebSocket(this.url)
    } catch {
      this.scheduleReconnect()
      return
    }
    this.ws = socket

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'auth', payload: { token: this.options.token } }))
    }

    socket.onmessage = (event) => {
      let message: WSMessage
      try {
        message = JSON.parse(String(event.data)) as WSMessage
      } catch {
        return
      }
      if (!message || typeof message.type !== 'string') return

      if (message.type === 'auth_ack') {
        this.attempt = 0
        this.options.onStatus?.('connected')
        return
      }
      if (message.type === 'auth_error') {
        this.stopped = true
        this.options.onStatus?.('unauthorized')
        this.closeSocket()
        return
      }

      this.options.onMessage(message)
    }

    socket.onclose = () => {
      this.ws = null
      if (this.stopped) return
      this.options.onStatus?.('disconnected')
      this.scheduleReconnect()
    }

    socket.onerror = () => {
      // onclose handles the retry; browser errors here are noisy and expected
      // while the backend is restarting.
    }
  }

  disconnect(): void {
    this.stopped = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.closeSocket()
    this.options.onStatus?.('disconnected')
  }

  private closeSocket(): void {
    if (!this.ws) return
    this.ws.onopen = null
    this.ws.onmessage = null
    this.ws.onclose = null
    this.ws.onerror = null
    this.ws.close()
    this.ws = null
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return
    const base = Math.min(RECONNECT_BASE_MS * 2 ** this.attempt, RECONNECT_MAX_MS)
    const jitter = base * 0.2 * (Math.random() * 2 - 1)
    const delay = Math.round(Math.min(base + jitter, RECONNECT_MAX_MS))
    this.attempt += 1
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }
}
