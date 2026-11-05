import { create } from 'zustand'
import Taro from '@tarojs/taro'
import type { Workspace } from '@/api/types'
import { resetApiClient } from '@/api'
import { queryClient } from '@/utils/query-client'

const SLUG_KEY = 'workspace_slug'
const WORKSPACE_KEY = 'current_workspace'

interface WorkspaceState {
  currentSlug: string | null
  currentWorkspace: Workspace | null
  init: () => void
  setWorkspace: (workspace: Workspace) => void
  clear: () => void
}

function readStoredWorkspace(): Workspace | null {
  try {
    const value = Taro.getStorageSync(WORKSPACE_KEY)
    if (!value) return null
    return typeof value === 'string' ? (JSON.parse(value) as Workspace) : (value as Workspace)
  } catch {
    return null
  }
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  currentSlug: null,
  currentWorkspace: null,

  init: () => {
    const slug = (Taro.getStorageSync(SLUG_KEY) as string) || null
    const workspace = readStoredWorkspace()
    set({ currentSlug: slug, currentWorkspace: workspace })
  },

  setWorkspace: (workspace: Workspace) => {
    Taro.setStorageSync(SLUG_KEY, workspace.slug)
    Taro.setStorageSync(WORKSPACE_KEY, workspace)
    resetApiClient()
    // Workspace-scoped caches belong to the previous workspace.
    queryClient.clear()
    set({ currentSlug: workspace.slug, currentWorkspace: workspace })
  },

  clear: () => {
    Taro.removeStorageSync(SLUG_KEY)
    Taro.removeStorageSync(WORKSPACE_KEY)
    resetApiClient()
    queryClient.clear()
    set({ currentSlug: null, currentWorkspace: null })
  },
}))
