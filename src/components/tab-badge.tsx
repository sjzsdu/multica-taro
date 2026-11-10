import { View, Text } from '@tarojs/components'
import { useUnreadCount } from '@/hooks/use-api'
import { useAuthStore } from '@/stores/auth-store'
import './tab-badge.scss'

/**
 * H5 does not implement `Taro.setTabBarBadge` (the H5 tab bar never listens
 * for the event), so the unread count is drawn as a fixed badge over the first
 * tab. Mini programs use the native API via `useTabBadge`.
 */
export function TabBadge() {
  const authed = useAuthStore((state) => state.status === 'authenticated')
  const { data: count } = useUnreadCount()

  if (process.env.TARO_ENV !== 'h5' || !authed || !count || count <= 0) {
    return null
  }

  return (
    <View className='tab-badge'>
      <Text className='tab-badge__text'>{count > 99 ? '99+' : count}</Text>
    </View>
  )
}
