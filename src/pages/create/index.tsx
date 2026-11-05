import { useMemo, useState } from 'react'
import { View, Text, ScrollView, Input, Textarea } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Avatar, Chevron, InlineError, OptionSheet, StatusBadge, SubPageHeader } from '@/components/ui'
import { useAuthGuard } from '@/hooks/use-auth-guard'
import { useActors, useCreateIssue, useProjects, useQuickCreateIssue } from '@/hooks/use-api'
import { errorMessage } from '@/api/client'
import type { IssuePriority } from '@/api/types'
import { priorityMeta, PRIORITY_ORDER, STATUS_ORDER } from '@/utils/format'
import './index.scss'

type Mode = 'manual' | 'agent'
type SheetKind = 'assignee' | 'project' | 'status' | 'priority' | null

export default function CreateIssuePage() {
  const status = useAuthGuard()
  const actors = useActors()
  const projects = useProjects()
  const createIssue = useCreateIssue()
  const quickCreate = useQuickCreateIssue()

  const [mode, setMode] = useState<Mode>('manual')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')
  const [statusValue, setStatusValue] = useState('todo')
  const [priority, setPriority] = useState<IssuePriority>('none')
  const [assigneeKey, setAssigneeKey] = useState<string>('none')
  const [projectId, setProjectId] = useState<string>('none')
  const [sheet, setSheet] = useState<SheetKind>(null)
  const [error, setError] = useState('')

  const selectedAssignee = useMemo(
    () => actors.options.find((option) => option.key === assigneeKey),
    [actors.options, assigneeKey],
  )
  const selectedProject = useMemo(
    () => (projects.data ?? []).find((item) => item.id === projectId),
    [projects.data, projectId],
  )

  const agentAssignees = actors.options.filter(
    (option) => option.type === 'agent' || option.type === 'squad',
  )

  const assigneeOptions =
    mode === 'manual'
      ? [
          { key: 'none', label: '不指派', description: '稍后再分配', active: assigneeKey === 'none' },
          ...actors.options.map((option) => ({
            key: option.key,
            label: option.name,
            description: option.hint,
            avatarSrc: option.avatarUrl,
            active: option.key === assigneeKey,
          })),
        ]
      : [
          {
            key: 'none',
            label: '选择智能体或小队',
            description: '快速派发需要一个执行者',
            active: assigneeKey === 'none',
          },
          ...agentAssignees.map((option) => ({
            key: option.key,
            label: option.name,
            description: option.hint,
            avatarSrc: option.avatarUrl,
            active: option.key === assigneeKey,
          })),
        ]

  const projectOptions = [
    { key: 'none', label: '无项目', active: projectId === 'none' },
    ...(projects.data ?? []).map((item) => ({
      key: item.id,
      label: item.title,
      active: item.id === projectId,
    })),
  ]

  const statusOptions = STATUS_ORDER.map((item) => ({
    key: item.key,
    label: item.label,
    active: statusValue === item.key,
  }))

  const priorityOptions = PRIORITY_ORDER.map((key) => ({
    key,
    label: priorityMeta(key).label,
    color: priorityMeta(key).color,
    active: priority === key,
  }))

  const canSubmit =
    mode === 'manual'
      ? title.trim().length > 0 && !createIssue.isPending
      : prompt.trim().length > 0 && assigneeKey !== 'none' && !quickCreate.isPending

  const handleSubmit = async () => {
    if (!canSubmit) {
      if (mode === 'manual' && !title.trim()) setError('请输入任务标题')
      else if (mode === 'agent' && !prompt.trim()) setError('请描述要派发的工作')
      else if (mode === 'agent' && assigneeKey === 'none') setError('请选择智能体或小队')
      return
    }

    setError('')
    try {
      if (mode === 'manual') {
        const [type, id] = assigneeKey.split(':')
        await createIssue.mutateAsync({
          title: title.trim(),
          description: description.trim() || undefined,
          status: statusValue,
          priority,
          project_id: projectId === 'none' ? undefined : projectId,
          assignee_type: assigneeKey === 'none' ? undefined : (type as 'member' | 'agent' | 'squad'),
          assignee_id: assigneeKey === 'none' ? undefined : id,
        })
        Taro.showToast({ title: '任务已创建', icon: 'success' })
      } else {
        const [type, id] = assigneeKey.split(':')
        await quickCreate.mutateAsync({
          prompt: prompt.trim(),
          priority,
          project_id: projectId === 'none' ? null : projectId,
          agent_id: type === 'agent' ? id : undefined,
          squad_id: type === 'squad' ? id : undefined,
        })
        Taro.showToast({ title: '已派发', icon: 'success' })
      }
      setTimeout(() => Taro.navigateBack(), 600)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  if (status === 'loading') return null

  return (
    <View className='create'>
      <SubPageHeader title='新建任务' subtitle={mode === 'manual' ? '直接创建' : '派发给智能体'} />
      <ScrollView className='create__scroll' scrollY>
        <View className='create__mode'>
          <View
            className={`create__mode-item ${mode === 'manual' ? 'is-active' : ''}`}
            onClick={() => {
              setMode('manual')
              setError('')
            }}
          >
            <Text className='create__mode-title'>直接创建</Text>
            <Text className='create__mode-desc'>自己写好任务再分配</Text>
          </View>
          <View
            className={`create__mode-item ${mode === 'agent' ? 'is-active' : ''}`}
            onClick={() => {
              setMode('agent')
              setError('')
            }}
          >
            <Text className='create__mode-title'>派发给智能体</Text>
            <Text className='create__mode-desc'>一句话交给它执行</Text>
          </View>
        </View>

        {mode === 'manual' ? (
          <>
            <View className='create__card'>
              <Text className='field-label'>标题</Text>
              <Input
                className='text-field create__title-input'
                value={title}
                placeholder='要做什么？'
                placeholderClass='input-placeholder'
                maxlength={300}
                onInput={(event) => {
                  setTitle(event.detail.value)
                  setError('')
                }}
              />
              <Text className='field-label create__label-gap'>描述</Text>
              <Textarea
                className='text-field text-field--multiline create__description'
                value={description}
                placeholder='补充背景、要求或参考链接（可选）'
                placeholderClass='input-placeholder'
                autoHeight
                maxlength={5000}
                onInput={(event) => setDescription(event.detail.value)}
              />
            </View>

            <View className='create__card'>
              <CreateRow label='状态' onClick={() => setSheet('status')}>
                <StatusBadge status={statusValue} />
              </CreateRow>
              <CreateRow label='优先级' onClick={() => setSheet('priority')}>
                <View className='create__priority'>
                  <View
                    className='create__priority-dot'
                    style={{ background: priorityMeta(priority).color }}
                  />
                  <Text className='create__value'>{priorityMeta(priority).label}</Text>
                </View>
              </CreateRow>
              <CreateRow label='负责人' onClick={() => setSheet('assignee')}>
                {selectedAssignee ? (
                  <View className='create__assignee'>
                    <Avatar
                      src={selectedAssignee.avatarUrl}
                      name={selectedAssignee.name}
                      size='xs'
                    />
                    <Text className='create__value'>{selectedAssignee.name}</Text>
                  </View>
                ) : (
                  <Text className='create__muted'>未指派</Text>
                )}
              </CreateRow>
              <CreateRow label='项目' onClick={() => setSheet('project')}>
                <Text className={selectedProject ? 'create__value' : 'create__muted'}>
                  {selectedProject?.title || '无项目'}
                </Text>
              </CreateRow>
            </View>
          </>
        ) : (
          <>
            <View className='create__card'>
              <Text className='field-label'>要派发的工作</Text>
              <Textarea
                className='text-field text-field--multiline create__prompt'
                value={prompt}
                placeholder='例如：梳理登录接口的失败场景，补上缺少的错误提示，并提交 PR。'
                placeholderClass='input-placeholder'
                autoHeight
                maxlength={4000}
                onInput={(event) => {
                  setPrompt(event.detail.value)
                  setError('')
                }}
              />
              <Text className='create__hint'>
                智能体会根据这段描述创建任务并开始执行，过程会出现在收件箱和任务动态里。
              </Text>
            </View>

            <View className='create__card'>
              <CreateRow label='执行者' onClick={() => setSheet('assignee')}>
                {selectedAssignee ? (
                  <View className='create__assignee'>
                    <Avatar
                      src={selectedAssignee.avatarUrl}
                      name={selectedAssignee.name}
                      size='xs'
                    />
                    <Text className='create__value'>{selectedAssignee.name}</Text>
                  </View>
                ) : (
                  <Text className='create__muted'>选择智能体或小队</Text>
                )}
              </CreateRow>
              <CreateRow label='优先级' onClick={() => setSheet('priority')}>
                <View className='create__priority'>
                  <View
                    className='create__priority-dot'
                    style={{ background: priorityMeta(priority).color }}
                  />
                  <Text className='create__value'>{priorityMeta(priority).label}</Text>
                </View>
              </CreateRow>
              <CreateRow label='项目' onClick={() => setSheet('project')}>
                <Text className={selectedProject ? 'create__value' : 'create__muted'}>
                  {selectedProject?.title || '无项目'}
                </Text>
              </CreateRow>
            </View>
          </>
        )}

        {error ? <InlineError message={error} /> : null}

        <View className='create__bottom-space' />
      </ScrollView>

      <View className='create__footer'>
        <View
          className={`create__submit ${canSubmit ? '' : 'is-disabled'}`}
          onClick={() => void handleSubmit()}
        >
          <Text className='create__submit-text'>
            {createIssue.isPending || quickCreate.isPending
              ? '提交中…'
              : mode === 'manual'
                ? '创建任务'
                : '派发任务'}
          </Text>
        </View>
      </View>

      <OptionSheet
        visible={sheet === 'assignee'}
        title={mode === 'manual' ? '选择负责人' : '选择执行者'}
        subtitle={mode === 'manual' ? '成员、智能体或小队' : '仅智能体和小队可以执行派发'}
        options={assigneeOptions}
        onSelect={(key) => {
          setAssigneeKey(key)
          setSheet(null)
          setError('')
        }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'project'}
        title='选择项目'
        options={projectOptions}
        onSelect={(key) => {
          setProjectId(key)
          setSheet(null)
        }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'status'}
        title='初始状态'
        options={statusOptions}
        onSelect={(key) => {
          setStatusValue(key)
          setSheet(null)
        }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'priority'}
        title='优先级'
        options={priorityOptions}
        onSelect={(key) => {
          setPriority(key as IssuePriority)
          setSheet(null)
        }}
        onClose={() => setSheet(null)}
      />
    </View>
  )
}

function CreateRow({
  label,
  children,
  onClick,
}: {
  label: string
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <View className='create__row' onClick={onClick}>
      <Text className='create__row-label'>{label}</Text>
      <View className='create__row-value'>
        {children}
        <Chevron />
      </View>
    </View>
  )
}
