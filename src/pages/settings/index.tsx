import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Avatar, Chevron, PageHeader, Spinner } from '@/components/ui'
import { useAuthGuard } from '@/hooks/use-auth-guard'
import { useArchivedInbox, useUnreadSummary } from '@/hooks/use-api'
import { useAuthStore } from '@/stores/auth-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAppearanceStore, type Density, type FontScale, type TaskView } from '@/stores/appearance-store'
import { TabBadge } from '@/components/tab-badge'
import './index.scss'

const FONT_SCALE_OPTIONS: { key: FontScale; label: string }[] = [
  { key: 'normal', label: '标准' },
  { key: 'large', label: '大' },
  { key: 'xlarge', label: '特大' },
]

const DENSITY_OPTIONS: { key: Density; label: string }[] = [
  { key: 'compact', label: '紧凑' },
  { key: 'cozy', label: '标准' },
  { key: 'comfortable', label: '宽松' },
]

const TASK_VIEW_OPTIONS: { key: TaskView; label: string }[] = [
  { key: 'list', label: '列表' },
  { key: 'tree', label: '树形' },
]

export default function SettingsPage() {
  const status = useAuthGuard()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  const workspace = useWorkspaceStore((state) => state.currentWorkspace)
  const fontScale = useAppearanceStore((state) => state.fontScale)
  const setFontScale = useAppearanceStore((state) => state.setFontScale)
  const density = useAppearanceStore((state) => state.density)
  const setDensity = useAppearanceStore((state) => state.setDensity)
  const taskView = useAppearanceStore((state) => state.taskView)
  const setTaskView = useAppearanceStore((state) => state.setTaskView)
  const autoRefresh = useAppearanceStore((state) => state.autoRefresh)
  const setAutoRefresh = useAppearanceStore((state) => state.setAutoRefresh)
  const unread = useUnreadSummary()
  const inbox = useArchivedInbox()

  const workspaceUnread = workspace
    ? (unread.data ?? []).find((entry) => entry.workspace_id === workspace.id)?.count ?? 0
    : 0
  const archivedCount = inbox.data?.length ?? 0

  const handleLogout = async () => {
    const result = await Taro.showModal({
      title: '退出登录',
      content: '退出后需要重新用邮箱验证码登录。',
      confirmText: '退出',
      confirmColor: '#D92D20',
    })
    if (!result.confirm) return
    await logout()
    void Taro.reLaunch({ url: '/pages/login/index' })
  }

  if (status === 'loading') return <Spinner label='正在恢复会话…' />

  return (
    <View className='screen settings'>
      <PageHeader title='我的' subtitle='账号与工作区设置' />

      <ScrollView className='screen__body settings__scroll' scrollY>
        <View className='settings__profile'>
          <Avatar src={user?.avatar_url} name={user?.name || user?.email} size='lg' />
          <View className='settings__profile-info'>
            <Text className='settings__name'>{user?.name || '未命名用户'}</Text>
            <Text className='settings__email'>{user?.email}</Text>
          </View>
        </View>

        <View className='settings__group'>
          <Text className='settings__group-title'>工作区</Text>
          <View className='settings__card'>
            <View
              className='settings__row'
              onClick={() => void Taro.navigateTo({ url: '/pages/workspace/index' })}
            >
              <Text className='settings__row-label'>当前工作区</Text>
              <View className='settings__row-value'>
                <Text className='settings__row-text'>{workspace?.name || '未选择'}</Text>
                {workspaceUnread > 0 ? (
                  <Text className='settings__pill'>{workspaceUnread}</Text>
                ) : null}
                <Chevron />
              </View>
            </View>
            <View
              className='settings__row'
              onClick={() => void Taro.navigateTo({ url: '/pages/inbox-archive/index' })}
            >
              <Text className='settings__row-label'>已归档通知</Text>
              <View className='settings__row-value'>
                <Text className='settings__row-text'>
                  {archivedCount > 0 ? `${archivedCount} 条` : '查看'}
                </Text>
                <Chevron />
              </View>
            </View>
          </View>
        </View>

        <View className='settings__group'>
          <Text className='settings__group-title'>外观</Text>
          <View className='settings__card'>
            <View className='settings__row settings__row--stack'>
              <Text className='settings__row-label'>字体大小</Text>
              <View className='settings__segmented'>
                {FONT_SCALE_OPTIONS.map((option) => (
                  <Text
                    key={option.key}
                    className={`settings__segment ${
                      fontScale === option.key ? 'is-active' : ''
                    }`}
                    onClick={() => setFontScale(option.key)}
                  >
                    {option.label}
                  </Text>
                ))}
              </View>
            </View>

            <View className='settings__row settings__row--stack'>
              <Text className='settings__row-label'>列表密度</Text>
              <View className='settings__segmented'>
                {DENSITY_OPTIONS.map((option) => (
                  <Text
                    key={option.key}
                    className={`settings__segment ${
                      density === option.key ? 'is-active' : ''
                    }`}
                    onClick={() => setDensity(option.key)}
                  >
                    {option.label}
                  </Text>
                ))}
              </View>
            </View>

            <View className='settings__row settings__row--stack'>
              <Text className='settings__row-label'>默认任务视图</Text>
              <View className='settings__segmented'>
                {TASK_VIEW_OPTIONS.map((option) => (
                  <Text
                    key={option.key}
                    className={`settings__segment ${
                      taskView === option.key ? 'is-active' : ''
                    }`}
                    onClick={() => setTaskView(option.key)}
                  >
                    {option.label}
                  </Text>
                ))}
              </View>
            </View>

            <View className='settings__row'>
              <View className='settings__switch-label'>
                <Text className='settings__row-label'>自动刷新收件箱</Text>
                <Text className='settings__switch-hint'>每 60 秒检查新通知</Text>
              </View>
              <View
                className={`settings__switch ${autoRefresh ? 'is-on' : ''}`}
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <View className='settings__switch-thumb' />
              </View>
            </View>
          </View>
        </View>

        <View className='settings__group'>
          <Text className='settings__group-title'>关于</Text>
          <View className='settings__card'>
            <View className='settings__row'>
              <Text className='settings__row-label'>客户端版本</Text>
              <Text className='settings__row-text'>0.1.0</Text>
            </View>
            <View className='settings__row'>
              <Text className='settings__row-label'>服务端</Text>
              <Text className='settings__row-text'>multica.wnbgj.com</Text>
            </View>
          </View>
        </View>

        <View className='settings__logout' onClick={() => void handleLogout()}>
          <Text className='settings__logout-text'>退出登录</Text>
        </View>

        <Text className='settings__footnote'>Multica · 人和智能体协作处理任务</Text>
        <View className='settings__bottom-space' />
      </ScrollView>
      <TabBadge />
    </View>
  )
}
