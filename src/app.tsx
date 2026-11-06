import { PropsWithChildren, useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './utils/query-client'
import { useAuthStore, installAuthInterceptor } from '@/stores/auth-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useWorkspaceBootstrap } from '@/hooks/use-workspace-bootstrap'
import { registerServiceWorker } from '@/utils/register-sw'
import { useRealtime } from '@/realtime/realtime-bridge'
import './app.scss'

function Bootstrap({ children }: PropsWithChildren) {
  const initAuth = useAuthStore((state) => state.init)
  const initWorkspace = useWorkspaceStore((state) => state.init)

  useEffect(() => {
    installAuthInterceptor()
    initWorkspace()
    void initAuth()
    registerServiceWorker()
  }, [initAuth, initWorkspace])

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
