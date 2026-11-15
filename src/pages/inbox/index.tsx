import { useEffect, useMemo, useRef, useState } from 'react'
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
import { TabBadge } from '@/components/tab-badge'
import { ListSkeleton } from '@/components/skeleton'
import './index.scss'

type Filter = 'all' | 'unread'

/** Inbox scroll offsets per workspace + filter. */
const inboxScrollPositions = new Map<string, number>()

function InboxRow({
  item,
  onOpen,
  onToggleRead,
  onArchive,
  onLongPress,
}: {
  item: InboxItem
  onOpen: () => void
  onToggleRead: () => void
  onArchive: () => void
  onLongPress: () => void
}) {
  return (
    <View
      className={`inbox-row ${item.read ? '' : 'is-unread'}`}
      onClick={onOpen}
      onLongPress={(event) => {
        event.stopPropagation()
        onLongPress()
      }}
    >
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

interface InboxGroup {
  key: string
  issueId: string | null
  items: InboxItem[]
  latest: InboxItem
  unreadCount: number
}

/** One row per issue: duplicate notifications (comments/status/runs) merge. */
function groupInboxItems(items: InboxItem[]): InboxGroup[] {
  const groups = new Map<string, InboxGroup>()
  for (const item of items) {
    const key = item.issue_id ? `issue:${item.issue_id}` : `item:${item.id}`
    const existing = groups.get(key)
    if (existing) {
      existing.items.push(item)
      if (item.created_at > existing.latest.created_at) existing.latest = item
      if (!item.read) existing.unreadCount += 1
    } else {
      groups.set(key, {
        key,
        issueId: item.issue_id,
        items: [item],
        latest: item,
        unreadCount: item.read ? 0 : 1,
      })
    }
  }
  return [...groups.values()].sort((a, b) =>
    b.latest.created_at.localeCompare(a.latest.created_at),
  )
}

function InboxGroupRow({
  group,
  onOpen,
  onToggleRead,
  onArchive,
  onLongPress,
}: {
  group: InboxGroup
  onOpen: () => void
  onToggleRead: () => void
  onArchive: () => void
  onLongPress: () => void
}) {
  const latest = group.latest
  const isRead = group.unreadCount === 0
  return (
    <View
      className={`inbox-row ${isRead ? '' : 'is-unread'}`}
      onClick={onOpen}
      onLongPress={(event) => {
        event.stopPropagation()
        onLongPress()
      }}
    >
      <View className='inbox-row__accent' style={{ background: inboxAccent(latest) }} />
      <View className='inbox-row__main'>
        <View className='inbox-row__top'>
          <View className='inbox-row__type-wrap'>
            <Text className='inbox-row__type'>{inboxTypeLabel(latest.type)}</Text>
            {group.items.length > 1 ? (
              <Text className='inbox-row__group-count'>{group.items.length} 条</Text>
            ) : null}
            {group.unreadCount > 0 ? (
              <Text className='inbox-row__unread-count'>{group.unreadCount} 未读</Text>
            ) : null}
          </View>
          <Text className='inbox-row__time'>{formatRelativeTime(latest.created_at)}</Text>
        </View>
        <Text className={`inbox-row__title ${isRead ? '' : 'is-unread'}`}>
          {latest.title}
        </Text>
        {latest.body ? <Text className='inbox-row__body'>{latest.body}</Text> : null}
        <View className='inbox-row__bottom'>
          <View className='inbox-row__meta'>
            {latest.issue_status ? (
              <StatusBadge status={latest.issue_status} compact />
            ) : (
              <Text className='inbox-row__system'>系统通知</Text>
            )}
            {latest.issue_priority ? <PriorityMark priority={latest.issue_priority} /> : null}
          </View>
          <View className='inbox-row__actions'>
            <Text
              className='inbox-row__action'
              onClick={(event) => {
                event.stopPropagation()
                onToggleRead()
              }}
            >
              {isRead ? '标为未读' : '标为已读'}
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
  const { setRead, setManyRead, archive, archiveMany, markAllRead, archiveAllRead, archiveAll, archiveCompleted } =
    useInboxActions()

  const [filter, setFilter] = useState<Filter>('all')
  const [menuOpen, setMenuOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [restoreScrollTop, setRestoreScrollTop] = useState<number | undefined>(undefined)
  const scrollControlledRef = useRef(false)
  const scrollKey = `${workspace?.slug ?? ''}|${filter}`

  useEffect(() => {
    const saved = inboxScrollPositions.get(scrollKey) ?? 0
    if (process.env.TARO_ENV === 'h5') {
      const timer = setTimeout(() => {
        const el = document.querySelector('.inbox__list') as HTMLElement | null
        if (el) el.scrollTop = saved
      }, 100)
      return () => clearTimeout(timer)
    }
    setRestoreScrollTop(saved)
    scrollControlledRef.current = true
  }, [scrollKey])

  useDidShow(() => {
    if (status === 'authenticated') void refetch()
  })

  const unreadCount = useMemo(() => (items ?? []).filter((item) => !item.read).length, [items])
  const groups = useMemo(() => groupInboxItems(items ?? []), [items])
  const visibleGroups = useMemo(
    () => (filter === 'unread' ? groups.filter((group) => group.unreadCount > 0) : groups),
    [groups, filter],
  )

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }

  const handleOpenGroup = async (group: InboxGroup) => {
    const unreadIds = group.items.filter((item) => !item.read).map((item) => item.id)
    if (unreadIds.length > 0) setManyRead.mutate({ ids: unreadIds, read: true })
    if (group.issueId) {
      await Taro.navigateTo({ url: `/pages/issue-detail/index?id=${group.issueId}` })
      return
    }
    Taro.showModal({
      title: group.latest.title,
      content: group.latest.body || '此通知没有更多内容。',
      showCancel: false,
      confirmText: '知道了',
    })
  }

  const handleToggleGroupRead = (group: InboxGroup) => {
    const targetRead = group.unreadCount > 0
    const ids = targetRead
      ? group.items.filter((item) => !item.read).map((item) => item.id)
      : group.items.map((item) => item.id)
    if (ids.length > 0) setManyRead.mutate({ ids, read: targetRead })
  }

  const handleArchiveGroup = (group: InboxGroup) => {
    archiveMany.mutate(group.items.map((item) => item.id))
  }

  const handleLongPressGroup = async (group: InboxGroup) => {
    try {
      const result = await Taro.showActionSheet({
        itemList: [group.unreadCount > 0 ? '标为已读' : '标为未读', '归档', '取消'],
      })
      if (result.tapIndex === 0) {
        handleToggleGroupRead(group)
      } else if (result.tapIndex === 1) {
        handleArchiveGroup(group)
      }
    } catch {
      // Dismissed.
    }
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
        scrollTop={process.env.TARO_ENV === 'h5' ? undefined : restoreScrollTop}
        onScroll={(event) => {
          inboxScrollPositions.set(scrollKey, event.detail.scrollTop)
          if (process.env.TARO_ENV !== 'h5' && scrollControlledRef.current) {
            scrollControlledRef.current = false
            setRestoreScrollTop(undefined)
          }
        }}
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={handleRefresh}
      >
        {isLoading && !items ? <ListSkeleton rows={5} /> : null}
        {isError ? (
          <InlineError message={errorMessage(error)} onRetry={() => void refetch()} />
        ) : null}

        {!isLoading && !isError && visibleGroups.length === 0 ? (
          <EmptyState
            title={filter === 'unread' ? '没有未读通知' : '收件箱已清空'}
            description='任务分配、评论提及和智能体运行结果都会出现在这里。'
          />
        ) : null}

        <View className='inbox__rows'>
          {visibleGroups.map((group) => (
            <InboxGroupRow
              key={group.key}
              group={group}
              onOpen={() => void handleOpenGroup(group)}
              onToggleRead={() => handleToggleGroupRead(group)}
              onArchive={() => handleArchiveGroup(group)}
              onLongPress={() => void handleLongPressGroup(group)}
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
      <TabBadge />
    </View>
  )
}
