import { useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Avatar, Badge, EmptyState, InlineError, Spinner, SubPageHeader } from '@/components/ui'
import { useAuthGuard } from '@/hooks/use-auth-guard'
import { useUnreadSummary, useWorkspaces } from '@/hooks/use-api'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { errorMessage } from '@/api/client'
import type { Workspace } from '@/api/types'
import './index.scss'

export default function WorkspacePage() {
  const status = useAuthGuard()
  const workspaces = useWorkspaces(status === 'authenticated')
  const unread = useUnreadSummary()
  const currentSlug = useWorkspaceStore((state) => state.currentSlug)
  const setWorkspace = useWorkspaceStore((state) => state.setWorkspace)

  useEffect(() => {
    if (status === 'authenticated') void workspaces.refetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const unreadFor = (workspace: Workspace): number =>
    (unread.data ?? []).find((entry) => entry.workspace_id === workspace.id)?.count ?? 0

  const handleSwitch = (workspace: Workspace) => {
    if (workspace.slug === currentSlug) {
      void Taro.navigateBack()
      return
    }
    setWorkspace(workspace)
    Taro.showToast({ title: `已切换到 ${workspace.name}`, icon: 'none' })
    setTimeout(() => Taro.navigateBack(), 500)
  }

  return (
    <View className='workspaces'>
      <SubPageHeader title='切换工作区' subtitle='任务与通知按工作区隔离' />
      <ScrollView className='workspaces__scroll' scrollY>
        <Text className='workspaces__intro'>
          任务、通知和智能体都按工作区隔离。切换后，列表会重新加载。
        </Text>

        {workspaces.isLoading ? <Spinner label='加载工作区…' /> : null}

        {workspaces.isError ? (
          <InlineError
            message={errorMessage(workspaces.error)}
            onRetry={() => void workspaces.refetch()}
          />
        ) : null}

        {!workspaces.isLoading && !workspaces.isError && (workspaces.data ?? []).length === 0 ? (
          <EmptyState
            title='还没有工作区'
            description='请先在网页端创建或加入一个工作区，然后回到这里刷新。'
            action={
              <View
                className='workspaces__refresh'
                onClick={() => void workspaces.refetch()}
              >
                <Text className='workspaces__refresh-text'>刷新</Text>
              </View>
            }
          />
        ) : null}

        <View className='workspaces__list'>
          {(workspaces.data ?? []).map((workspace) => {
            const active = workspace.slug === currentSlug
            const count = unreadFor(workspace)
            return (
              <View
                key={workspace.id}
                className={`workspaces__item ${active ? 'is-active' : ''}`}
                onClick={() => handleSwitch(workspace)}
              >
                <Avatar src={workspace.avatar_url} name={workspace.name} size='md' />
                <View className='workspaces__info'>
                  <Text className='workspaces__name'>{workspace.name}</Text>
                  <Text className='workspaces__slug'>{workspace.slug}</Text>
                </View>
                <View className='workspaces__right'>
                  {count > 0 ? <Badge count={count} /> : null}
                  {active ? <Text className='workspaces__badge'>当前</Text> : null}
                </View>
              </View>
            )
          })}
        </View>

        <View className='workspaces__bottom-space' />
      </ScrollView>
    </View>
  )
}
