import { useMemo, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { EmptyState, InlineError, PriorityMark, Spinner, StatusBadge, SubPageHeader } from '@/components/ui'
import { useAuthGuard } from '@/hooks/use-auth-guard'
import { useArchivedInbox, useInboxActions } from '@/hooks/use-api'
import { errorMessage } from '@/api/client'
import { formatRelativeTime, inboxAccent, inboxTypeLabel } from '@/utils/format'
import './index.scss'

export default function InboxArchivePage() {
  const status = useAuthGuard()
  const archived = useArchivedInbox()
  const { unarchive, setRead } = useInboxActions()
  const [refreshing, setRefreshing] = useState(false)

  const items = useMemo(
    () => (archived.data ?? []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [archived.data],
  )

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await archived.refetch()
    } finally {
      setRefreshing(false)
    }
  }

  if (status === 'loading') return <Spinner label='正在恢复会话…' />

  return (
    <View className='archive'>
      <SubPageHeader title='已归档通知' subtitle='归档不会删除任何任务' />
      <ScrollView
        className='archive__scroll'
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={handleRefresh}
      >
        {archived.isLoading ? <Spinner label='加载归档…' /> : null}
        {archived.isError ? (
          <InlineError
            message={errorMessage(archived.error)}
            onRetry={() => void archived.refetch()}
          />
        ) : null}

        {!archived.isLoading && !archived.isError && items.length === 0 ? (
          <EmptyState title='没有已归档的通知' description='归档后的通知会保留在这里。' />
        ) : null}

        <View className='archive__list'>
          {items.map((item) => (
            <View className='archive__item' key={item.id}>
              <View className='archive__accent' style={{ background: inboxAccent(item) }} />
              <View className='archive__main'>
                <View className='archive__top'>
                  <Text className='archive__type'>{inboxTypeLabel(item.type)}</Text>
                  <Text className='archive__time'>{formatRelativeTime(item.created_at)}</Text>
                </View>
                <Text className='archive__title'>{item.title}</Text>
                {item.body ? <Text className='archive__body'>{item.body}</Text> : null}
                <View className='archive__foot'>
                  <View className='archive__meta'>
                    {item.issue_status ? <StatusBadge status={item.issue_status} compact /> : null}
                    {item.issue_priority ? <PriorityMark priority={item.issue_priority} /> : null}
                  </View>
                  <View className='archive__actions'>
                    {item.issue_id ? (
                      <Text
                        className='archive__action'
                        onClick={() =>
                          void Taro.navigateTo({ url: `/pages/issue-detail/index?id=${item.issue_id}` })
                        }
                      >
                        查看任务
                      </Text>
                    ) : null}
                    <Text
                      className='archive__action'
                      onClick={() => setRead.mutate({ id: item.id, read: !item.read })}
                    >
                      {item.read ? '标为未读' : '标为已读'}
                    </Text>
                    <Text
                      className='archive__action archive__action--primary'
                      onClick={() =>
                        unarchive.mutate(item.id, {
                          onSuccess: () => Taro.showToast({ title: '已移回收件箱', icon: 'none' }),
                        })
                      }
                    >
                      取消归档
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View className='archive__bottom-space' />
      </ScrollView>
    </View>
  )
}
