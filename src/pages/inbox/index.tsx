import { useMemo, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import {
  Badge,
  Chip,
  EmptyState,
  InlineError,
  OptionSheet,
  PageHeader,
  PriorityMark,
  Spinner,
  StatusBadge,
} from '@/components/ui'
import { useAuthGuard } from '@/hooks/use-auth-guard'
import { useInbox, useInboxActions } from '@/hooks/use-api'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { errorMessage } from '@/api/client'
import type { InboxItem } from '@/api/types'
import { inboxAccent, inboxTypeLabel, formatRelativeTime } from '@/utils/format'
import './index.scss'

type Filter = 'all' | 'unread'

function InboxRow({
  item,
  onOpen,
  onToggleRead,
  onArchive,
}: {
  item: InboxItem
  onOpen: () => void
  onToggleRead: () => void
  onArchive: () => void
}) {
  return (
    <View className={`inbox-row ${item.read ? '' : 'is-unread'}`} onClick={onOpen}>
      <View className='inbox-row__accent' style={{ background: inboxAccent(item) }} />
      <View className='inbox-row__main'>
        <View className='inbox-row__top'>
          <Text className='inbox-row__type'>{inboxTypeLabel(item.type)}</Text>
          <Text className='inbox-row__time'>{formatRelativeTime(item.created_at)}</Text>
        </View>
        <Text className={`inbox-row__title ${item.read ? '' : 'is-unread'}`}>{item.title}</Text>
        {item.body ? <Text className='inbox-row__body'>{item.body}</Text> : null}
        <View className='inbox-row__bottom'>
          <View className='inbox-row__meta'>
            {item.issue_status ? (
              <StatusBadge status={item.issue_status} compact />
            ) : (
              <Text className='inbox-row__system'>系统通知</Text>
            )}
            {item.issue_priority ? <PriorityMark priority={item.issue_priority} /> : null}
          </View>
          <View className='inbox-row__actions'>
            <Text
              className='inbox-row__action'
              onClick={(event) => {
                event.stopPropagation()
                onToggleRead()
              }}
            >
              {item.read ? '标为未读' : '标为已读'}
            </Text>
            <Text
              className='inbox-row__action'
              onClick={(event) => {
                event.stopPropagation()
                onArchive()
              }}
            >
              归档
            </Text>
          </View>
        </View>
      </View>
    </View>
  )
}

export default function InboxPage() {
  const status = useAuthGuard()
  const workspace = useWorkspaceStore((state) => state.currentWorkspace)
  const { data: items, isLoading, isError, error, refetch } = useInbox()
  const { setRead, archive, markAllRead, archiveAllRead, archiveAll, archiveCompleted } =
    useInboxActions()

  const [filter, setFilter] = useState<Filter>('all')
  const [menuOpen, setMenuOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useDidShow(() => {
    if (status === 'authenticated') void refetch()
  })

  const unreadCount = useMemo(() => (items ?? []).filter((item) => !item.read).length, [items])
  const visible = useMemo(() => {
    const list = items ?? []
    return filter === 'unread' ? list.filter((item) => !item.read) : list
  }, [items, filter])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }

  const handleOpen = async (item: InboxItem) => {
    if (!item.read) setRead.mutate({ id: item.id, read: true })
    if (item.issue_id) {
      await Taro.navigateTo({ url: `/pages/issue-detail/index?id=${item.issue_id}` })
      return
    }
    Taro.showModal({
      title: item.title,
      content: item.body || '此通知没有更多内容。',
      showCancel: false,
      confirmText: '知道了',
    })
  }

  const handleMenuSelect = async (key: string) => {
    setMenuOpen(false)

    if (key === 'mark-all-read') {
      markAllRead.mutate(undefined, {
        onSuccess: (result) =>
          Taro.showToast({ title: `已标记 ${result.count} 条为已读`, icon: 'none' }),
      })
      return
    }
    if (key === 'archive-read') {
      archiveAllRead.mutate(undefined, {
        onSuccess: (result) =>
          Taro.showToast({ title: `已归档 ${result.count} 条已读通知`, icon: 'none' }),
      })
      return
    }
    if (key === 'archive-completed') {
      archiveCompleted.mutate(undefined, {
        onSuccess: (result) =>
          Taro.showToast({ title: `已归档 ${result.count} 条已完成通知`, icon: 'none' }),
      })
      return
    }
    if (key === 'archive-all') {
      const result = await Taro.showModal({
        title: '归档全部通知？',
        content: '包括未读通知。任务本身不会被删除，仍可在任务页查看。',
        confirmText: '归档',
        confirmColor: '#D92D20',
      })
      if (!result.confirm) return
      archiveAll.mutate(undefined, {
        onSuccess: (res) =>
          Taro.showToast({ title: `已归档 ${res.count} 条通知`, icon: 'none' }),
      })
      return
    }
    if (key === 'archived') {
      void Taro.navigateTo({ url: '/pages/inbox-archive/index' })
    }
  }

  if (status === 'loading') {
    return <Spinner label='正在恢复会话…' />
  }

  const menuOptions = [
    {
      key: 'mark-all-read',
      label: '全部标为已读',
      description: unreadCount ? `${unreadCount} 条未读` : '没有未读通知',
    },
    { key: 'archive-read', label: '归档已读通知' },
    {
      key: 'archive-completed',
      label: '归档已完成的通知',
      description: '任务已完成的收件箱项',
    },
    {
      key: 'archive-all',
      label: '归档全部通知',
      description: '包括未读，任务不会被删除',
    },
    { key: 'archived', label: '查看已归档' },
  ]

  return (
    <View className='screen inbox'>
      <PageHeader
        title='收件箱'
        subtitle={workspace ? workspace.name : '尚未选择工作区'}
        right={
          <>
            {unreadCount > 0 ? <Badge count={unreadCount} /> : null}
            <View className='inbox__batch-button' onClick={() => setMenuOpen(true)}>
              <Text className='inbox__batch-text'>批量</Text>
            </View>
          </>
        }
      >
        <View className='inbox__filters'>
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
            全部
          </Chip>
          <Chip active={filter === 'unread'} onClick={() => setFilter('unread')}>
            未读 {unreadCount > 0 ? unreadCount : ''}
          </Chip>
        </View>
      </PageHeader>

      <ScrollView
        className='screen__body inbox__list'
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={handleRefresh}
      >
        {isLoading && !items ? <Spinner label='加载通知…' /> : null}
        {isError ? (
          <InlineError message={errorMessage(error)} onRetry={() => void refetch()} />
        ) : null}

        {!isLoading && !isError && visible.length === 0 ? (
          <EmptyState
            title={filter === 'unread' ? '没有未读通知' : '收件箱已清空'}
            description='任务分配、评论提及和智能体运行结果都会出现在这里。'
          />
        ) : null}

        <View className='inbox__rows'>
          {visible.map((item) => (
            <InboxRow
              key={item.id}
              item={item}
              onOpen={() => void handleOpen(item)}
              onToggleRead={() =>
                setRead.mutate({ id: item.id, read: !item.read })
              }
              onArchive={() => archive.mutate(item.id)}
            />
          ))}
        </View>

        <View className='inbox__bottom-space' />
      </ScrollView>

      <OptionSheet
        visible={menuOpen}
        title='收件箱操作'
        options={menuOptions}
        onSelect={handleMenuSelect}
        onClose={() => setMenuOpen(false)}
      />
    </View>
  )
}
