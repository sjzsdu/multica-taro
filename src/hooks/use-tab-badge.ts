import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { useUnreadCount } from '@/hooks/use-api'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Mirrors the inbox unread count onto the first tab ("收件箱").
 *
 * `setTabBarBadge` is only valid while a tab page is mounted, so failures are
 * ignored: the effect re-runs on every count change and on login, which is
 * when the tab bar becomes available.
 */
export function useTabBadge(): void {
  const authed = useAuthStore((state) => state.status === 'authenticated')
  const { data: count } = useUnreadCount()

  useEffect(() => {
    if (!authed) return
    // H5 renders <TabBadge /> instead: its tab bar ignores the badge event.
    if (process.env.TARO_ENV === 'h5') return

    const sync = async () => {
      try {
        if (count && count > 0) {
          await Taro.setTabBarBadge({
            index: 0,
            text: count > 99 ? '99+' : String(count),
          })
        } else {
          await Taro.removeTabBarBadge({ index: 0 })
        }
      } catch {
        // Not on a tab page yet (e.g. login / detail route).
      }
    }

    void sync()
  }, [authed, count])
}
