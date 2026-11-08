import { PropsWithChildren, useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './utils/query-client'
import { useAuthStore, installAuthInterceptor } from '@/stores/auth-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useWorkspaceBootstrap } from '@/hooks/use-workspace-bootstrap'
import { registerServiceWorker } from '@/utils/register-sw'
import { useRealtime } from '@/realtime/realtime-bridge'
import { useAppearanceStore } from '@/stores/appearance-store'
import './app.scss'

function Bootstrap({ children }: PropsWithChildren) {
  const initAuth = useAuthStore((state) => state.init)
  const initWorkspace = useWorkspaceStore((state) => state.init)
  const initAppearance = useAppearanceStore((state) => state.init)

  useEffect(() => {
    installAuthInterceptor()
    initWorkspace()
    initAppearance()
    void initAuth()
    registerServiceWorker()
  }, [initAuth, initWorkspace, initAppearance])

  useWorkspaceBootstrap()
  useRealtime()

  return <>{children}</>
}

function App({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <Bootstrap>{children}</Bootstrap>
    </QueryClientProvider>
  )
}

export default App
