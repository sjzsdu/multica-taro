import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { useAuthStore, type AuthStatus } from '@/stores/auth-store'

/**
 * Redirects unauthenticated visitors to the login page and returns the current
 * auth status so a page can render a splash instead of an empty shell while the
 * session is being restored.
 */
export function useAuthGuard(): AuthStatus {
  const status = useAuthStore((state) => state.status)

  useEffect(() => {
    if (status === 'guest') {
      Taro.redirectTo({ url: '/pages/login/index' })
    }
  }, [status])

  return status
}
