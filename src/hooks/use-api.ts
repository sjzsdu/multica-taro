import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import Taro from '@tarojs/taro'
import * as inboxApi from '@/api/endpoints/inbox'
import * as issuesApi from '@/api/endpoints/issues'
import * as workspaceApi from '@/api/endpoints/workspace'
import type {
  Agent,
  CreateIssueRequest,
  InboxItem,
  InboxWorkspaceUnread,
  Issue,
  IssueAssigneeType,
  ListIssuesParams,
  Member,
  Project,
  Squad,
  TimelineEntry,
  UpdateIssueRequest,
  Workspace,
} from '@/api/types'
import { useAuthStore } from '@/stores/auth-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAppearanceStore } from '@/stores/appearance-store'
import { errorMessage } from '@/api/client'

const PAGE_SIZE = 20

/** Query keys are workspace-scoped so switching never leaks another's data. */
export const queryKeys = {
  workspaces: () => ['workspaces'] as const,
  workspace: (slug: string | null) => ['workspace', slug] as const,
  projects: (slug: string | null) => ['workspace', slug, 'projects'] as const,
  agents: (slug: string | null) => ['workspace', slug, 'agents'] as const,
  squads: (slug: string | null) => ['workspace', slug, 'squads'] as const,
  members: (slug: string | null, workspaceId: string | undefined) =>
    ['workspace', slug, 'members', workspaceId] as const,
  issues: (slug: string | null) => ['workspace', slug, 'issues'] as const,
  issueList: (slug: string | null, filters: unknown) => ['workspace', slug, 'issues', 'list', filters] as const,
  childProgress: (slug: string | null) => ['workspace', slug, 'issues', 'child-progress'] as const,
  issueChildren: (slug: string | null, id: string) =>
    ['workspace', slug, 'issue', id, 'children'] as const,
  issue: (slug: string | null, id: string) => ['workspace', slug, 'issue', id] as const,
  timeline: (slug: string | null, id: string) => ['workspace', slug, 'issue', id, 'timeline'] as const,
  inbox: (slug: string | null) => ['workspace', slug, 'inbox'] as const,
  unreadCount: (slug: string | null) => ['workspace', slug, 'inbox', 'unread-count'] as const,
  inboxArchived: (slug: string | null) => ['workspace', slug, 'inbox', 'archived'] as const,
  unreadSummary: () => ['inbox', 'unread-summary'] as const,
}

function useSlug(): string | null {
  return useWorkspaceStore((state) => state.currentSlug)
}

function useAuthed(): boolean {
  return useAuthStore((state) => state.status === 'authenticated')
}

export function useWorkspaces(enabled = true) {
  const authed = useAuthed()
  return useQuery({
    queryKey: queryKeys.workspaces(),
    queryFn: () => workspaceApi.listWorkspaces(),
    enabled: authed && enabled,
    staleTime: 5 * 60_000,
  })
}

export function useProjects() {
  const slug = useSlug()
  return useQuery({
    queryKey: queryKeys.projects(slug),
    queryFn: () => workspaceApi.listProjects().then((res) => res.projects),
    enabled: !!slug,
  })
}

export function useAgents() {
  const slug = useSlug()
  return useQuery({
    queryKey: queryKeys.agents(slug),
    queryFn: () => workspaceApi.listAgents(),
    enabled: !!slug,
  })
}

export function useSquads() {
  const slug = useSlug()
  return useQuery({
    queryKey: queryKeys.squads(slug),
    queryFn: () => workspaceApi.listSquads(),
    enabled: !!slug,
  })
}

export function useMembers() {
  const slug = useSlug()
  const workspaceId = useWorkspaceStore((state) => state.currentWorkspace?.id)
  return useQuery({
    queryKey: queryKeys.members(slug, workspaceId),
    queryFn: () => workspaceApi.listMembers(workspaceId as string),
    enabled: !!workspaceId,
  })
}

export interface ActorOption {
  key: string
  id: string
  type: IssueAssigneeType
  name: string
  avatarUrl?: string | null
  hint?: string
}

/** Members, agents and squads flattened into one assignee picker list. */
export function useActors() {
  const members = useMembers()
  const agents = useAgents()
  const squads = useSquads()

  const options: ActorOption[] = [
    ...(members.data ?? []).map((m) => ({
      key: `member:${m.id}`,
      id: m.id,
      type: 'member' as const,
      name: m.name || m.email,
      avatarUrl: m.avatar_url,
      hint: '成员',
    })),
    ...(agents.data ?? [])
      .filter((a) => !a.archived_at)
      .map((a) => ({
        key: `agent:${a.id}`,
        id: a.id,
        type: 'agent' as const,
        name: a.name,
        avatarUrl: a.avatar_url,
        hint: a.runtime_bound === false ? '智能体 · 未绑定运行时' : '智能体',
      })),
    ...(squads.data ?? [])
      .filter((s) => !s.archived_at)
      .map((s) => ({
        key: `squad:${s.id}`,
        id: s.id,
        type: 'squad' as const,
        name: s.name,
        avatarUrl: s.avatar_url,
        hint: '小队',
      })),
  ]

  const find = (type: string | null | undefined, id: string | null | undefined): ActorOption | undefined => {
    if (!type || !id) return undefined
    return options.find((o) => o.type === type && o.id === id)
  }

  return {
    options,
    find,
    members: members.data ?? [],
    agents: agents.data ?? [],
    squads: squads.data ?? [],
    isLoading: members.isLoading || agents.isLoading || squads.isLoading,
  }
}

export function useIssues(
  filters: Omit<ListIssuesParams, 'limit' | 'offset'>,
  enabled = true,
) {
  const slug = useSlug()
  return useInfiniteQuery({
    queryKey: queryKeys.issueList(slug, filters),
    queryFn: ({ pageParam }) =>
      issuesApi.listIssues({ ...filters, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((sum, page) => sum + page.issues.length, 0)
      if (loaded >= last.total) return undefined
      if (last.issues.length === 0) return undefined
      return loaded
    },
    enabled: enabled && !!slug,
    staleTime: 15_000,
  })
}

export function useIssueChildren(id: string, enabled = true) {
  const slug = useSlug()
  return useQuery({
    queryKey: queryKeys.issueChildren(slug, id),
    queryFn: () => issuesApi.listChildIssues(id).then((res) => res.issues),
    enabled: enabled && !!id && !!slug,
    staleTime: 15_000,
  })
}

export function useChildProgress() {
  const slug = useSlug()
  return useQuery({
    queryKey: queryKeys.childProgress(slug),
    queryFn: () => issuesApi.getChildProgress().then((res) => res.progress),
    enabled: !!slug,
    staleTime: 30_000,
  })
}

export function useIssue(id: string) {
  const slug = useSlug()
  return useQuery({
    queryKey: queryKeys.issue(slug, id),
    queryFn: () => issuesApi.getIssue(id),
    enabled: !!id && !!slug,
  })
}

export function useIssueTimeline(id: string) {
  const slug = useSlug()
  return useQuery({
    queryKey: queryKeys.timeline(slug, id),
    queryFn: () => issuesApi.listTimeline(id),
    enabled: !!id && !!slug,
  })
}

export function useInbox() {
  const slug = useSlug()
  const autoRefresh = useAppearanceStore((state) => state.autoRefresh)
  return useQuery({
    queryKey: queryKeys.inbox(slug),
    queryFn: () => inboxApi.listInbox(),
    enabled: !!slug,
    staleTime: 15_000,
    refetchInterval: autoRefresh ? 60_000 : false,
  })
}

export function useArchivedInbox() {
  const slug = useSlug()
  return useQuery({
    queryKey: queryKeys.inboxArchived(slug),
    queryFn: () => inboxApi.listArchivedInbox(),
    enabled: !!slug,
  })
}

export function useUnreadCount() {
  const slug = useSlug()
  const autoRefresh = useAppearanceStore((state) => state.autoRefresh)
  return useQuery({
    queryKey: queryKeys.unreadCount(slug),
    queryFn: () => inboxApi.getUnreadCount().then((res) => res.count),
    enabled: !!slug,
    staleTime: 15_000,
    refetchInterval: autoRefresh ? 30_000 : false,
  })
}

export function useUnreadSummary() {
  const authed = useAuthed()
  return useQuery({
    queryKey: queryKeys.unreadSummary(),
    queryFn: () => inboxApi.getUnreadSummary() as Promise<InboxWorkspaceUnread[]>,
    enabled: authed,
  })
}

function patchInboxCache(
  queryClient: ReturnType<typeof useQueryClient>,
  slug: string | null,
  updater: (items: InboxItem[]) => InboxItem[],
): void {
  queryClient.setQueriesData<InboxItem[]>({ queryKey: queryKeys.inbox(slug) }, (old) =>
    old ? updater(old) : old,
  )
}

/** Inbox read/archive mutations with optimistic cache patches. */
export function useInboxActions() {
  const queryClient = useQueryClient()
  const slug = useSlug()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.inbox(slug) })
    queryClient.invalidateQueries({ queryKey: queryKeys.unreadSummary() })
  }

  const setRead = useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      read ? inboxApi.markRead(id) : inboxApi.markUnread(id),
    onMutate: async ({ id, read }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.inbox(slug) })
      const previous = queryClient.getQueryData<InboxItem[]>(queryKeys.inbox(slug))
      patchInboxCache(queryClient, slug, (items) =>
        items.map((item) => (item.id === id ? { ...item, read } : item)),
      )
      return { previous }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.inbox(slug), context.previous)
      Taro.showToast({ title: errorMessage(err), icon: 'none' })
    },
    onSettled: invalidate,
  })

  const archive = useMutation({
    mutationFn: (id: string) => inboxApi.archiveItem(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.inbox(slug) })
      const previous = queryClient.getQueryData<InboxItem[]>(queryKeys.inbox(slug))
      patchInboxCache(queryClient, slug, (items) => items.filter((item) => item.id !== id))
      return { previous }
    },
    onError: (err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.inbox(slug), context.previous)
      Taro.showToast({ title: errorMessage(err), icon: 'none' })
    },
    onSettled: invalidate,
  })

  const unarchive = useMutation({
    mutationFn: (id: string) => inboxApi.unarchiveItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.inbox(slug) })
      queryClient.invalidateQueries({ queryKey: queryKeys.inboxArchived(slug) })
    },
    onError: (err) => Taro.showToast({ title: errorMessage(err), icon: 'none' }),
  })

  const markAllRead = useMutation({
    mutationFn: () => inboxApi.markAllRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.inbox(slug) })
      const previous = queryClient.getQueryData<InboxItem[]>(queryKeys.inbox(slug))
      patchInboxCache(queryClient, slug, (items) => items.map((item) => ({ ...item, read: true })))
      return { previous }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.inbox(slug), context.previous)
      Taro.showToast({ title: errorMessage(err), icon: 'none' })
    },
    onSettled: invalidate,
  })

  const archiveAllRead = useMutation({
    mutationFn: () => inboxApi.archiveAllRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.inbox(slug) })
      const previous = queryClient.getQueryData<InboxItem[]>(queryKeys.inbox(slug))
      patchInboxCache(queryClient, slug, (items) => items.filter((item) => !item.read))
      return { previous }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.inbox(slug), context.previous)
      Taro.showToast({ title: errorMessage(err), icon: 'none' })
    },
    onSettled: invalidate,
  })

  const archiveAll = useMutation({
    mutationFn: () => inboxApi.archiveAll(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.inbox(slug) })
      const previous = queryClient.getQueryData<InboxItem[]>(queryKeys.inbox(slug))
      patchInboxCache(queryClient, slug, () => [])
      return { previous }
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKeys.inbox(slug), context.previous)
      Taro.showToast({ title: errorMessage(err), icon: 'none' })
    },
    onSettled: invalidate,
  })

  const archiveCompleted = useMutation({
    mutationFn: () => inboxApi.archiveCompleted(),
    onSuccess: () => invalidate(),
    onError: (err) => Taro.showToast({ title: errorMessage(err), icon: 'none' }),
  })

  return {
    setRead,
    archive,
    unarchive,
    markAllRead,
    archiveAllRead,
    archiveAll,
    archiveCompleted,
  }
}

export function useCreateIssue() {
  const queryClient = useQueryClient()
  const slug = useSlug()
  return useMutation({
    mutationFn: (data: CreateIssueRequest) => issuesApi.createIssue(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues(slug) })
      queryClient.invalidateQueries({ queryKey: queryKeys.inbox(slug) })
    },
  })
}

export function useQuickCreateIssue() {
  const queryClient = useQueryClient()
  const slug = useSlug()
  return useMutation({
    mutationFn: (data: Parameters<typeof issuesApi.quickCreateIssue>[0]) =>
      issuesApi.quickCreateIssue(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues(slug) })
      queryClient.invalidateQueries({ queryKey: queryKeys.inbox(slug) })
    },
  })
}

export function useUpdateIssue() {
  const queryClient = useQueryClient()
  const slug = useSlug()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateIssueRequest }) =>
      issuesApi.updateIssue(id, data),
    onSuccess: (issue, { id }) => {
      queryClient.setQueryData<Issue>(queryKeys.issue(slug, id), issue)
      queryClient.invalidateQueries({ queryKey: queryKeys.issues(slug) })
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline(slug, id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.inbox(slug) })
    },
  })
}

export function useBatchUpdateIssues() {
  const queryClient = useQueryClient()
  const slug = useSlug()
  return useMutation({
    mutationFn: ({ ids, updates }: { ids: string[]; updates: UpdateIssueRequest }) =>
      issuesApi.batchUpdateIssues(ids, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues(slug) })
      queryClient.invalidateQueries({ queryKey: queryKeys.inbox(slug) })
    },
    onError: (err) => Taro.showToast({ title: errorMessage(err), icon: 'none' }),
  })
}

export function useCreateComment(issueId: string) {
  const queryClient = useQueryClient()
  const slug = useSlug()
  return useMutation({
    mutationFn: ({
      content,
      attachmentIds,
      parentId,
    }: {
      content: string
      attachmentIds?: string[]
      parentId?: string
    }) => issuesApi.createComment(issueId, content, attachmentIds, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.timeline(slug, issueId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.issue(slug, issueId) })
    },
  })
}

export type {
  Agent,
  InboxItem,
  InboxWorkspaceUnread,
  Issue,
  Member,
  Project,
  Squad,
  TimelineEntry,
  Workspace,
}
