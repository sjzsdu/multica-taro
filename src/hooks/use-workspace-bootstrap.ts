import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { useAuthStore } from '@/stores/auth-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useWorkspaces } from '@/hooks/use-api'

/**
 * Keeps the request-scoped workspace in sync with the server list.
 *
 * The slug is what the API client sends as `X-Workspace-Slug`; it has to point
 * at a workspace the user actually belongs to. A stale persisted slug (left
 * over after being removed from a workspace) is repaired here.
 */
export function useWorkspaceBootstrap(): void {
  const status = useAuthStore((state) => state.status)
  const { data: workspaces } = useWorkspaces(status === 'authenticated')
  const currentSlug = useWorkspaceStore((state) => state.currentSlug)
  const setWorkspace = useWorkspaceStore((state) => state.setWorkspace)

  useEffect(() => {
    if (status !== 'authenticated' || !workspaces || workspaces.length === 0) return

    const match = currentSlug ? workspaces.find((w) => w.slug === currentSlug) : undefined
    if (match) return

    const storedSlug = (Taro.getStorageSync('workspace_slug') as string) || null
    const storedMatch = storedSlug ? workspaces.find((w) => w.slug === storedSlug) : undefined
    setWorkspace(storedMatch ?? workspaces[0])
  }, [status, workspaces, currentSlug, setWorkspace])
}
