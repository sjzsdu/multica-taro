import { create } from 'zustand'
import Taro from '@tarojs/taro'
import type { User } from '@/api/types'
import * as authApi from '@/api/endpoints/auth'
import { resetApiClient, setUnauthorizedHandler } from '@/api'
import { queryClient } from '@/utils/query-client'

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'auth_user'

export type AuthStatus = 'loading' | 'authenticated' | 'guest'

interface AuthState {
  user: User | null
  token: string | null
  status: AuthStatus
  login: (email: string, code: string) => Promise<void>
  sendCode: (email: string) => Promise<void>
  logout: (options?: { remote?: boolean }) => Promise<void>
  refreshUser: () => Promise<void>
  init: () => Promise<void>
  clearSession: () => void
}

function readStoredUser(): User | null {
  try {
    const value = Taro.getStorageSync(USER_KEY)
    if (!value) return null
    return typeof value === 'string' ? (JSON.parse(value) as User) : (value as User)
  } catch {
    return null
  }
}

function persistSession(token: string, user: User): void {
  Taro.setStorageSync(TOKEN_KEY, token)
  Taro.setStorageSync(USER_KEY, user)
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  status: 'loading',

  init: async () => {
    const token = (Taro.getStorageSync(TOKEN_KEY) as string) || null
    if (!token) {
      set({ status: 'guest', token: null, user: null })
      return
    }

    // Trust the cached identity for the first paint, then verify in the
    // background. A rejected token lands in clearSession via onUnauthorized.
    const cachedUser = readStoredUser()
    set({ token, user: cachedUser, status: cachedUser ? 'authenticated' : 'loading' })

    try {
      const user = await authApi.getMe()
      Taro.setStorageSync(USER_KEY, user)
      set({ user, status: 'authenticated' })
    } catch {
      if (!get().token) return
      // Network failures should not eject a valid session; only a token the
      // server refused is worth clearing. 401 already fired onUnauthorized.
      set((state) => ({ status: state.user ? 'authenticated' : 'guest' }))
    }
  },

  sendCode: async (email: string) => {
    await authApi.sendCode(email)
  },

  login: async (email: string, code: string) => {
    const res = await authApi.verifyCode(email, code)
    persistSession(res.token, res.user)
    resetApiClient()
    queryClient.clear()
    set({ token: res.token, user: res.user, status: 'authenticated' })
  },

  refreshUser: async () => {
    const user = await authApi.getMe()
    Taro.setStorageSync(USER_KEY, user)
    set({ user })
  },

  clearSession: () => {
    Taro.removeStorageSync(TOKEN_KEY)
    Taro.removeStorageSync(USER_KEY)
    resetApiClient()
    queryClient.clear()
    set({ token: null, user: null, status: 'guest' })
  },

  logout: async (options) => {
    if (options?.remote !== false) {
      try {
        await authApi.logout()
      } catch {
        // The local session is what matters; the server call is best effort.
      }
    }
    Taro.removeStorageSync('workspace_slug')
    Taro.removeStorageSync('current_workspace')
    get().clearSession()
  },
}))

/** Wire the API client's 401 path to the auth store (called once at boot). */
export function installAuthInterceptor(): void {
  setUnauthorizedHandler(() => {
    const state = useAuthStore.getState()
    if (!state.token) return
    state.clearSession()
    Taro.reLaunch({ url: '/pages/login/index' })
  })
}
