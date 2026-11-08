import { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import {
  Avatar,
  Chip,
  EmptyState,
  InlineError,
  OptionSheet,
  PageHeader,
  PlusIcon,
  PriorityMark,
  Spinner,
  StatusBadge,
} from '@/components/ui'
import { useAuthGuard } from '@/hooks/use-auth-guard'
import { useActors, useChildProgress, useIssueChildren, useIssues, useMembers } from '@/hooks/use-api'
import { useAuthStore } from '@/stores/auth-store'
import { errorMessage } from '@/api/client'
import type { ListIssuesParams, Issue } from '@/api/types'
import { formatDate, isOverdue, priorityMeta, STATUS_ORDER } from '@/utils/format'
import './index.scss'

type QuickView = 'all' | 'mine' | 'in_progress' | 'done'

const QUICK_VIEWS: { key: QuickView; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'mine', label: '我负责的' },
  { key: 'in_progress', label: '进行中' },
  { key: 'done', label: '已完成' },
]

function IssueCard({
  issue,
  onOpen,
  findActor,
}: {
  issue: Issue
  onOpen: () => void
  findActor: ReturnType<typeof useActors>['find']
}) {
  const assignee = findActor(issue.assignee_type, issue.assignee_id)
  const priority = priorityMeta(issue.priority)
  const overdue = isOverdue(issue.due_date)

  return (
    <View className='issue-card' onClick={onOpen}>
      <View className='issue-card__head'>
        <Text className='issue-card__identifier'>{issue.identifier}</Text>
        <View className='issue-card__head-right'>
          {issue.due_date ? (
            <Text className={`issue-card__due ${overdue ? 'is-overdue' : ''}`}>
              {formatDate(issue.due_date)}
            </Text>
          ) : null}
          <PriorityMark priority={issue.priority} />
        </View>
      </View>

      <Text className='issue-card__title'>{issue.title}</Text>

      <View className='issue-card__foot'>
        <View className='issue-card__foot-left'>
          <StatusBadge status={issue.status} name={issue.status_name} />
          {issue.labels?.slice(0, 2).map((label) => (
            <Text
              key={label.id}
              className='issue-card__label'
              style={{ color: label.color, background: `${label.color}18` }}
            >
              {label.name}
            </Text>
          ))}
        </View>
        <View className='issue-card__assignee'>
          {assignee ? (
            <>
              <Avatar src={assignee.avatarUrl} name={assignee.name} size='xs' />
              <Text className='issue-card__assignee-name'>{assignee.name}</Text>
            </>
          ) : (
            <Text className='issue-card__unassigned'>未指派</Text>
          )}
        </View>
      </View>

      {priority.rank >= 3 ? (
        <View className='issue-card__priority-flag' style={{ background: priority.color }} />
      ) : null}
    </View>
  )
}

function matchesFilters(
  issue: Issue,
  filters: Omit<ListIssuesParams, 'limit' | 'offset'>,
): boolean {
  if (filters.status && issue.status !== filters.status) return false
  if (filters.statuses?.length && !filters.statuses.includes(issue.status)) return false
  if (filters.priority && issue.priority !== filters.priority) return false
  if (filters.assignee_id && issue.assignee_id !== filters.assignee_id) return false
  if (filters.project_id && issue.project_id !== filters.project_id) return false
  return true
}

function IssueTreeNode({
  issue,
  depth,
  actors,
  progressMap,
  filters,
  expanded,
  onToggle,
}: {
  issue: Issue
  depth: number
  actors: ReturnType<typeof useActors>
  progressMap: Map<string, { total: number; done: number }>
  filters: Omit<ListIssuesParams, 'limit' | 'offset'>
  expanded: Set<string>
  onToggle: (id: string) => void
}) {
  const assignee = actors.find(issue.assignee_type, issue.assignee_id)
  const progress = progressMap.get(issue.id)
  const hasChildren = (progress?.total ?? 0) > 0
  const isExpanded = expanded.has(issue.id)
  const childrenQuery = useIssueChildren(issue.id, isExpanded)
  const children = (childrenQuery.data ?? []).filter((child) =>
    matchesFilters(child, filters),
  )

  return (
    <View className='tree-node' style={depth > 0 ? { marginLeft: 14 } : undefined}>
      <View
        className='tree-node__row'
        onClick={() =>
          void Taro.navigateTo({ url: `/pages/issue-detail/index?id=${issue.id}` })
        }
      >
        <View
          className={`tree-node__chevron ${hasChildren ? 'is-branch' : ''} ${
            isExpanded ? 'is-open' : ''
          }`}
          onClick={(event) => {
            event.stopPropagation()
            if (hasChildren) onToggle(issue.id)
          }}
        >
          {hasChildren ? (
            <Text className='tree-node__chevron-text'>›</Text>
          ) : (
            <View className='tree-node__leaf' />
          )}
        </View>

        <View className='tree-node__body'>
          <View className='tree-node__top'>
            <Text className='tree-node__id'>{issue.identifier}</Text>
            <StatusBadge status={issue.status} name={issue.status_name} compact />
            {progress ? (
              <Text className='tree-node__progress'>
                {progress.done}/{progress.total}
              </Text>
            ) : null}
            <PriorityMark priority={issue.priority} />
          </View>
          <Text className='tree-node__title'>{issue.title}</Text>
          <View className='tree-node__meta'>
            {assignee ? (
              <>
                <Avatar src={assignee.avatarUrl} name={assignee.name} size='xs' />
                <Text className='tree-node__assignee'>{assignee.name}</Text>
              </>
            ) : (
              <Text className='tree-node__unassigned'>未指派</Text>
            )}
            {issue.due_date ? (
              <Text className='tree-node__due'>截止 {formatDate(issue.due_date)}</Text>
            ) : null}
          </View>
        </View>
      </View>

      {isExpanded ? (
        <View className='tree-node__children'>
          {childrenQuery.isLoading ? (
            <Text className='tree-node__hint'>加载子任务…</Text>
          ) : children.length === 0 ? (
            <Text className='tree-node__hint'>没有匹配的子任务</Text>
          ) : (
            children.map((child) => (
              <IssueTreeNode
                key={child.id}
                issue={child}
                depth={depth + 1}
                actors={actors}
                progressMap={progressMap}
                filters={filters}
                expanded={expanded}
                onToggle={onToggle}
              />
            ))
          )}
        </View>
      ) : null}
    </View>
  )
}

function useDebounced<T>(value: T, delay = 320): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function IssuesPage() {
  const status = useAuthGuard()
  const user = useAuthStore((state) => state.user)
  const members = useMembers()
  const actors = useActors()

  const [view, setView] = useState<QuickView>('all')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [statusSheetOpen, setStatusSheetOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const debouncedSearch = useDebounced(search)

  const currentMemberId = useMemo(() => {
    if (!user) return undefined
    return (members.data ?? []).find((member) => member.user_id === user.id)?.id
  }, [members.data, user])

  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const filters = useMemo<Omit<ListIssuesParams, 'limit' | 'offset'>>(() => {
    const next: Omit<ListIssuesParams, 'limit' | 'offset'> = {
      sort_by: 'last_activity',
      sort_direction: 'desc',
    }
    if (debouncedSearch.trim()) next.q = debouncedSearch.trim()

    const quickStatus =
      view === 'in_progress' ? 'in_progress' : view === 'done' ? 'done' : undefined
    const effectiveStatus = statusFilter !== 'all' ? statusFilter : quickStatus
    if (effectiveStatus) next.status = effectiveStatus
    if (view === 'mine' && currentMemberId) next.assignee_id = currentMemberId
    return next
  }, [debouncedSearch, view, statusFilter, currentMemberId])

  const listQuery = useIssues(filters, viewMode === 'list')
  const treeFilters = useMemo(() => ({ ...filters, top_level_only: true }), [filters])
  const treeQuery = useIssues(treeFilters, viewMode === 'tree')
  const query = viewMode === 'tree' ? treeQuery : listQuery

  const issues = useMemo(
    () => (listQuery.data?.pages ?? []).flatMap((page) => page.issues),
    [listQuery.data],
  )
  const rootIssues = useMemo(
    () => (treeQuery.data?.pages ?? []).flatMap((page) => page.issues),
    [treeQuery.data],
  )
  const progressQuery = useChildProgress()
  const progressMap = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>()
    for (const entry of progressQuery.data ?? []) {
      map.set(entry.parent_issue_id, { total: entry.total, done: entry.done })
    }
    return map
  }, [progressQuery.data])

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const currentIssues = viewMode === 'tree' ? rootIssues : issues

  useDidShow(() => {
    if (status === 'authenticated') void query.refetch()
    // Refetching on every tab focus keeps the list current after editing an
    // issue, without polling while the tab is hidden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await query.refetch()
    } finally {
      setRefreshing(false)
    }
  }

  const activeView = statusFilter !== 'all' ? 'custom' : view

  if (status === 'loading') return <Spinner label='正在恢复会话…' />

  const statusOptions = [
    { key: 'all', label: '全部状态', active: statusFilter === 'all' },
    ...STATUS_ORDER.map((item) => ({
      key: item.key,
      label: item.label,
      active: statusFilter === item.key,
    })),
  ]

  return (
    <View className='screen issues'>
      <PageHeader
        title='任务'
        subtitle={
          query.data
            ? viewMode === 'tree'
              ? `${query.data.pages[0]?.total ?? 0} 个根任务`
              : `${query.data.pages[0]?.total ?? 0} 个任务`
            : undefined
        }
        right={
          <View className='issues__actions'>
            <View
              className='issues__view-toggle'
              onClick={() => setViewMode((mode) => (mode === 'list' ? 'tree' : 'list'))}
            >
              <Text className='issues__view-toggle-text'>
                {viewMode === 'list' ? '树形' : '列表'}
              </Text>
            </View>
            <View
              className='issues__create'
              onClick={() => void Taro.navigateTo({ url: '/pages/create/index' })}
            >
              <PlusIcon />
              <Text className='issues__create-text'>新建</Text>
            </View>
          </View>
        }
      >
        <View className='issues__search'>
          <View className='issues__search-icon'>
            <View className='issues__search-lens' />
            <View className='issues__search-handle' />
          </View>
          <Input
            className='issues__search-input'
            value={search}
            placeholder='搜索任务标题或编号'
            placeholderClass='input-placeholder'
            confirmType='search'
            onInput={(event) => setSearch(event.detail.value)}
          />
          {search ? (
            <Text className='issues__search-clear' onClick={() => setSearch('')}>
              清除
            </Text>
          ) : null}
        </View>

        <ScrollView scrollX className='issues__chips'>
          {QUICK_VIEWS.map((item) => (
            <Chip
              key={item.key}
              active={activeView === item.key}
              onClick={() => {
                setView(item.key)
                setStatusFilter('all')
              }}
            >
              {item.label}
            </Chip>
          ))}
          <Chip active={statusFilter !== 'all'} onClick={() => setStatusSheetOpen(true)}>
            {statusFilter === 'all'
              ? '筛选状态'
              : STATUS_ORDER.find((item) => item.key === statusFilter)?.label || statusFilter}
          </Chip>
        </ScrollView>
      </PageHeader>

      <ScrollView
        className='screen__body issues__list'
        scrollY
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={handleRefresh}
        onScrollToLower={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage()
        }}
        lowerThreshold={80}
      >
        {query.isLoading ? <Spinner label='加载任务…' /> : null}

        {query.isError ? (
          <InlineError message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : null}

        {!query.isLoading && !query.isError && currentIssues.length === 0 ? (
          <EmptyState
            title={search ? '没有匹配的任务' : '还没有任务'}
            description={
              search
                ? '换个关键词，或清除筛选后再试。'
                : '点击右上角“新建”，把第一件事派给成员或智能体。'
            }
          />
        ) : null}

        {viewMode === 'tree' ? (
          <View className='issues__tree'>
            {rootIssues.map((issue) => (
              <IssueTreeNode
                key={issue.id}
                issue={issue}
                depth={0}
                actors={actors}
                progressMap={progressMap}
                filters={filters}
                expanded={expanded}
                onToggle={toggleExpanded}
              />
            ))}
          </View>
        ) : (
          <View className='issues__cards'>
            {issues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                findActor={actors.find}
                onOpen={() =>
                  void Taro.navigateTo({ url: `/pages/issue-detail/index?id=${issue.id}` })
                }
              />
            ))}
          </View>
        )}

        {query.isFetchingNextPage ? (
          <Text className='issues__more'>加载更多…</Text>
        ) : query.hasNextPage ? (
          <Text className='issues__more'>
            {viewMode === 'tree' ? '上拉加载更多根任务' : '上拉加载更多'}
          </Text>
        ) : currentIssues.length > 0 ? (
          <Text className='issues__more'>没有更多了</Text>
        ) : null}

        <View className='issues__bottom-space' />
      </ScrollView>

      <OptionSheet
        visible={statusSheetOpen}
        title='按状态筛选'
        subtitle='与“我负责的”等视图可以叠加'
        options={statusOptions}
        onSelect={(key) => {
          setStatusFilter(key)
          setStatusSheetOpen(false)
        }}
        onClose={() => setStatusSheetOpen(false)}
      />
    </View>
  )
}
