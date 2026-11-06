import { useEffect } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { queryKeys } from '@/hooks/use-api'
import { RealtimeClient, type WSMessage } from './ws-client'

/**
 * Pulls the issue id out of the event payloads the mobile client cares about.
 * Payload shapes differ per event (`issue`, `issue_id`, `comment.issue_id`), so
 * anything unrecognised simply falls back to invalidating the list queries.
 */
function extractIssueId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const record = payload as Record<string, unknown>

  if (typeof record.issue_id === 'string') return record.issue_id

  const issue = record.issue
  if (issue && typeof issue === 'object') {
    const id = (issue as Record<string, unknown>).id
    if (typeof id === 'string') return id
  }

  const comment = record.comment
  if (comment && typeof comment === 'object') {
    const id = (comment as Record<string, unknown>).issue_id
    if (typeof id === 'string') return id
  }

  return undefined
}

function invalidateIssue(
  queryClient: QueryClient,
  slug: string,
  issueId: string | undefined,
): void {
  queryClient.invalidateQueries({ queryKey: queryKeys.issues(slug) })
  if (!issueId) return
  queryClient.invalidateQueries({ queryKey: queryKeys.issue(slug, issueId) })
  queryClient.invalidateQueries({ queryKey: queryKeys.timeline(slug, issueId) })
}

function handleMessage(
  queryClient: QueryClient,
  slug: string | null,
  message: WSMessage,
): void {
  if (!slug) return
  const { type, payload } = message

  // Progress ticks are high-frequency and nothing on this client renders them.
  if (type === 'task:progress') return

  if (type.startsWith('inbox:')) {
    queryClient.invalidateQueries({ queryKey: queryKeys.inbox(slug) })
    queryClient.invalidateQueries({ queryKey: queryKeys.inboxArchived(slug) })
    queryClient.invalidateQueries({ queryKey: queryKeys.unreadSummary() })
    return
  }

  if (type.startsWith('task:')) {
    invalidateIssue(queryClient, slug, extractIssueId(payload))
    return
  }

  if (
    type.startsWith('issue:') ||
    type.startsWith('issue_') ||
    type.startsWith('comment:') ||
    type.startsWith('reaction:') ||
    type === 'activity:created'
  ) {
    invalidateIssue(queryClient, slug, extractIssueId(payload))
    return
  }

  if (type.startsWith('agent:') || type.startsWith('squad:') || type.startsWith('member:')) {
    // Prefix match so the workspace-scoped member list (which carries the
    // workspace id in its key) is invalidated too.
    queryClient.invalidateQueries({ queryKey: ['workspace', slug, 'agents'] })
    queryClient.invalidateQueries({ queryKey: ['workspace', slug, 'squads'] })
    queryClient.invalidateQueries({ queryKey: ['workspace', slug, 'members'] })
    return
  }

  if (type === 'workspace:updated' || type === 'workspace:deleted') {
    queryClient.invalidateQueries({ queryKey: queryKeys.workspaces() })
    return
  }

  if (type.startsWith('project:') || type.startsWith('label:') || type.startsWith('property:')) {
    queryClient.invalidateQueries({ queryKey: ['workspace', slug] })
  }
}

/**
 * Mounted once in the app shell. Holds no render output: it opens the socket
 * while signed in with an active workspace and turns server events into React
 * Query invalidations. Other platforms keep their existing polling/refetch
 * behaviour until they get a native socket implementation.
 *
 * Implemented as a hook rather than a rendered component so the Taro app shell
 * keeps a single `children` root (the router) on H5.
 */
export function useRealtime(): void {
  const status = useAuthStore((state) => state.status)
  const token = useAuthStore((state) => state.token)
  const slug = useWorkspaceStore((state) => state.currentSlug)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (process.env.TARO_ENV !== 'h5') return
    // webpack-dev-server's HMR socket owns /ws in development, so the dev
    // proxy cannot reliably forward the backend socket. Production builds
    // (nginx proxies /ws) and the Docker image are what this targets.
    if (process.env.NODE_ENV !== 'production') return
    if (status !== 'authenticated' || !token || !slug) return

    const client = new RealtimeClient({
      token,
      workspaceSlug: slug,
      onMessage: (message) => handleMessage(queryClient, slug, message),
    })
    client.connect()
    return () => client.disconnect()
  }, [status, token, slug, queryClient])
}
