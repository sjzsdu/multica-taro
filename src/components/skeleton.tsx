import { View } from '@tarojs/components'
import './skeleton.scss'

/** Lightweight list placeholder shown while the first page loads. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View className='skeleton-list'>
      {Array.from({ length: rows }).map((_, index) => (
        <View key={index} className='skeleton-card'>
          <View className='skeleton-line skeleton-line--short' />
          <View className='skeleton-line' />
          <View className='skeleton-line skeleton-line--medium' />
        </View>
      ))}
    </View>
  )
}
