import { useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Textarea, Input, Picker, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import {
  Avatar,
  InlineError,
  KeyValueRow,
  OptionSheet,
  PriorityMark,
  Spinner,
  StatusBadge,
  SubPageHeader,
} from '@/components/ui'
import { useAuthGuard } from '@/hooks/use-auth-guard'
import {
  useActors,
  useCreateComment,
  useIssue,
  useIssueTimeline,
  useProjects,
  useUpdateIssue,
} from '@/hooks/use-api'
import { errorMessage } from '@/api/client'
import * as issuesApi from '@/api/endpoints/issues'
import type { Attachment, IssuePriority, TimelineEntry } from '@/api/types'
import {
  activityLabel,
  formatDate,
  formatRelativeTime,
  isCommentEntry,
  priorityMeta,
  PRIORITY_ORDER,
  STATUS_ORDER,
} from '@/utils/format'
import { parseMarkdown, type MarkdownBlock } from '@/utils/markdown'
import './index.scss'

type SheetKind = 'status' | 'priority' | 'assignee' | 'project' | null

interface PendingImage {
  key: string
  path: string
  id?: string
  uploading: boolean
}

export default function IssueDetailPage() {
  const status = useAuthGuard()
  const router = useRouter()
  const issueId = router.params.id || ''

  const issueQuery = useIssue(issueId)
  const timelineQuery = useIssueTimeline(issueId)
  const updateIssue = useUpdateIssue()
  const createComment = useCreateComment(issueId)
  const projects = useProjects()
  const actors = useActors()

  const issue = issueQuery.data
  const timeline = timelineQuery.data ?? []
  const description = issue?.description ?? ''
  const { blocks: descriptionBlocks, headings } = useMemo(
    () => parseMarkdown(description),
    [description],
  )

  const [sheet, setSheet] = useState<SheetKind>(null)
  const [tocOpen, setTocOpen] = useState(false)
  const [scrollTarget, setScrollTarget] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [commentDraft, setCommentDraft] = useState('')
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const viewportHeight = useKeyboardViewport()

  const assignee = useMemo(
    () => (issue ? actors.find(issue.assignee_type, issue.assignee_id) : undefined),
    [issue, actors],
  )
  const project = useMemo(
    () => (issue?.project_id ? (projects.data ?? []).find((p) => p.id === issue.project_id) : undefined),
    [issue?.project_id, projects.data],
  )

  const notifyError = (err: unknown) => Taro.showToast({ title: errorMessage(err), icon: 'none' })

  const patch = (data: Parameters<typeof updateIssue.mutate>[0]['data']) => {
    if (!issue) return
    updateIssue.mutate(
      { id: issue.id, data },
      { onError: notifyError },
    )
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([issueQuery.refetch(), timelineQuery.refetch()])
    } finally {
      setRefreshing(false)
    }
  }

  const handleSaveTitle = () => {
    const next = titleDraft.trim()
    if (!issue || !next) {
      setEditingTitle(false)
      return
    }
    if (next === issue.title) {
      setEditingTitle(false)
      return
    }
    updateIssue.mutate(
      { id: issue.id, data: { title: next } },
      {
        onError: notifyError,
        onSuccess: () => setEditingTitle(false),
      },
    )
  }

  const handleSaveDescription = () => {
    if (!issue) return
    const next = descriptionDraft.trim()
    if (next === (issue.description ?? '')) {
      setEditingDescription(false)
      return
    }
    updateIssue.mutate(
      { id: issue.id, data: { description: next } },
      {
        onError: notifyError,
        onSuccess: () => setEditingDescription(false),
      },
    )
  }

  const handleChooseImage = async () => {
    if (pendingImages.length >= 6) {
      Taro.showToast({ title: '最多添加 6 张图片', icon: 'none' })
      return
    }

    let paths: string[] = []
    try {
      const result = await Taro.chooseImage({
        count: 6 - pendingImages.length,
        sizeType: ['compressed'],
      })
      paths = result.tempFilePaths ?? []
    } catch {
      // User cancelled the picker.
      return
    }

    const items: PendingImage[] = paths.map((path, index) => ({
      key: `${Date.now()}-${index}-${path}`,
      path,
      uploading: true,
    }))
    setPendingImages((prev) => [...prev, ...items])

    await Promise.all(
      items.map(async (item) => {
        try {
          const attachment = await issuesApi.uploadFile(item.path)
          setPendingImages((prev) =>
            prev.map((entry) =>
              entry.key === item.key ? { ...entry, id: attachment.id, uploading: false } : entry,
            ),
          )
        } catch (err) {
          setPendingImages((prev) => prev.filter((entry) => entry.key !== item.key))
          notifyError(err)
        }
      }),
    )
  }

  const handleRemoveImage = (item: PendingImage) => {
    setPendingImages((prev) => prev.filter((entry) => entry.key !== item.key))
    if (item.id) {
      void issuesApi.deleteAttachment(item.id).catch(() => {
        // Orphan cleanup is best effort; the comment is what matters.
      })
    }
  }

  const handleSendComment = () => {
    const content = commentDraft.trim()
    if (!content || createComment.isPending) return
    if (pendingImages.some((item) => item.uploading)) {
      Taro.showToast({ title: '图片还在上传中', icon: 'none' })
      return
    }

    const attachmentIds = pendingImages
      .map((item) => item.id)
      .filter((id): id is string => Boolean(id))

    createComment.mutate(
      { content, attachmentIds },
      {
        onError: notifyError,
        onSuccess: () => {
          setCommentDraft('')
          setPendingImages([])
        },
      },
    )
  }

  if (status === 'loading') return <Spinner label='正在恢复会话…' />

  if (issueQuery.isLoading) return <Spinner label='加载任务…' />

  if (issueQuery.isError) {
    return (
      <View className='detail detail--error'>
        <InlineError message={errorMessage(issueQuery.error)} onRetry={() => void issueQuery.refetch()} />
      </View>
    )
  }

  if (!issue) {
    return (
      <View className='detail detail--error'>
        <Text className='detail__missing'>任务不存在或已被删除</Text>
      </View>
    )
  }

  const statusOptions = [
    ...STATUS_ORDER.map((item) => ({
      key: item.key,
      label: item.label,
      color: undefined,
      active: issue.status === item.key,
    })),
    ...(issue.status && !STATUS_ORDER.some((item) => item.key === issue.status)
      ? [
          {
            key: issue.status,
            label: issue.status_name || issue.status,
            color: undefined,
            active: true,
          },
        ]
      : []),
  ]

  const priorityOptions = PRIORITY_ORDER.map((key) => ({
    key,
    label: priorityMeta(key).label,
    color: priorityMeta(key).color,
    active: issue.priority === key,
  }))

  const assigneeOptions = [
    { key: 'none', label: '不指派', description: '保持未指派', active: !issue.assignee_id },
    ...actors.options.map((option) => ({
      key: option.key,
      label: option.name,
      description: option.hint,
      avatarSrc: option.avatarUrl,
      active: option.type === issue.assignee_type && option.id === issue.assignee_id,
    })),
  ]

  const projectOptions = [
    { key: 'none', label: '无项目', active: !issue.project_id },
    ...(projects.data ?? []).map((item) => ({
      key: item.id,
      label: item.title,
      description: item.status === 'completed' ? '已完成' : undefined,
      active: item.id === issue.project_id,
    })),
  ]

  const handleSheetSelect = (key: string) => {
    const kind = sheet
    setSheet(null)
    if (kind === 'status') patch({ status: key })
    if (kind === 'priority') patch({ priority: key as IssuePriority })
    if (kind === 'assignee') {
      if (key === 'none') {
        patch({ assignee_type: null, assignee_id: null })
      } else {
        const [type, id] = key.split(':')
        patch({ assignee_type: type as 'member' | 'agent' | 'squad', assignee_id: id })
      }
    }
    if (kind === 'project') {
      patch({ project_id: key === 'none' ? null : key })
    }
  }

  return (
    <View
      className='detail'
      style={viewportHeight ? { height: `${viewportHeight}px` } : undefined}
    >
      <SubPageHeader
        title={issue.identifier}
        subtitle={issue.title.length > 22 ? `${issue.title.slice(0, 22)}…` : issue.title}
        right={
          headings.length > 0 ? (
            <View className='detail__toc-btn' onClick={() => setTocOpen(true)}>
              <Text className='detail__toc-btn-text'>目录</Text>
            </View>
          ) : undefined
        }
      />
      <ScrollView
        className='detail__scroll'
        scrollY
        scrollIntoView={scrollTarget || undefined}
        refresherEnabled
        refresherTriggered={refreshing}
        onRefresherRefresh={handleRefresh}
      >
        <View className='detail__header'>
          <View className='detail__kicker'>
            <Text className='detail__identifier'>{issue.identifier}</Text>
            <StatusBadge status={issue.status} name={issue.status_name} />
            <PriorityMark priority={issue.priority} showLabel />
          </View>

          {editingTitle ? (
            <View className='detail__title-edit'>
              <Input
                className='text-field detail__title-input'
                value={titleDraft}
                focus
                maxlength={300}
                onInput={(event) => setTitleDraft(event.detail.value)}
                onConfirm={handleSaveTitle}
                confirmType='done'
              />
              <View className='detail__edit-actions'>
                <Text className='detail__edit-cancel' onClick={() => setEditingTitle(false)}>
                  取消
                </Text>
                <Text className='detail__edit-save' onClick={handleSaveTitle}>
                  保存
                </Text>
              </View>
            </View>
          ) : (
            <Text
              className='detail__title'
              onClick={() => {
                setTitleDraft(issue.title)
                setEditingTitle(true)
              }}
            >
              {issue.title}
            </Text>
          )}
        </View>

        <View className='detail__card'>
          <KeyValueRow label='状态' onClick={() => setSheet('status')}>
            <StatusBadge status={issue.status} name={issue.status_name} />
          </KeyValueRow>
          <KeyValueRow label='优先级' onClick={() => setSheet('priority')}>
            <PriorityMark priority={issue.priority} showLabel />
          </KeyValueRow>
          <KeyValueRow label='负责人' onClick={() => setSheet('assignee')}>
            {assignee ? (
              <View className='detail__assignee'>
                <Avatar src={assignee.avatarUrl} name={assignee.name} size='xs' />
                <Text className='detail__assignee-name'>{assignee.name}</Text>
              </View>
            ) : (
              <Text className='detail__muted'>未指派</Text>
            )}
          </KeyValueRow>
          <KeyValueRow label='项目' onClick={() => setSheet('project')}>
            <Text className={project ? 'detail__value' : 'detail__muted'}>
              {project?.title || '无项目'}
            </Text>
          </KeyValueRow>
          <KeyValueRow label='截止日期'>
            <Picker
              mode='date'
              value={issue.due_date || ''}
              start='2000-01-01'
              onChange={(event) => patch({ due_date: String(event.detail.value) })}
            >
              <Text className={issue.due_date ? 'detail__value' : 'detail__muted'}>
                {issue.due_date ? formatDate(issue.due_date) : '未设置'}
              </Text>
            </Picker>
          </KeyValueRow>
          <KeyValueRow label='创建于'>
            <Text className='detail__muted'>{formatRelativeTime(issue.created_at)}</Text>
          </KeyValueRow>
        </View>

        <View className='detail__card detail__card--block'>
          <View className='detail__section-head'>
            <Text className='detail__section-title'>描述</Text>
            {!editingDescription ? (
              <Text
                className='detail__section-action'
                onClick={() => {
                  setDescriptionDraft(issue.description ?? '')
                  setEditingDescription(true)
                }}
              >
                {issue.description ? '编辑' : '添加'}
              </Text>
            ) : null}
          </View>

          {editingDescription ? (
            <View>
              <Textarea
                className='text-field text-field--multiline detail__description-input'
                value={descriptionDraft}
                autoHeight
                maxlength={5000}
                placeholder='补充背景、验收标准或相关链接…'
                placeholderClass='input-placeholder'
                onInput={(event) => setDescriptionDraft(event.detail.value)}
              />
              <View className='detail__edit-actions'>
                <Text className='detail__edit-cancel' onClick={() => setEditingDescription(false)}>
                  取消
                </Text>
                <Text className='detail__edit-save' onClick={handleSaveDescription}>
                  保存描述
                </Text>
              </View>
            </View>
          ) : description ? (
            <MarkdownBody blocks={descriptionBlocks} />
          ) : (
            <Text className='detail__description is-empty'>暂无描述</Text>
          )}
        </View>

        <View id='comments' className='detail__card detail__card--block'>
          <View className='detail__section-head'>
            <Text className='detail__section-title'>动态与评论</Text>
            <Text className='detail__section-count'>{timeline.length}</Text>
          </View>

          {timelineQuery.isLoading ? <Spinner label='加载动态…' /> : null}

          {!timelineQuery.isLoading && timeline.length === 0 ? (
            <Text className='detail__muted detail__timeline-empty'>还没有动态，发第一条评论吧。</Text>
          ) : null}

          <View className='timeline'>
            {timeline.map((entry) => (
              <TimelineRow key={`${entry.type}-${entry.id}`} entry={entry} />
            ))}
          </View>
        </View>

        <View className='detail__scroll-space' />
      </ScrollView>

      {pendingImages.length > 0 ? (
        <ScrollView scrollX className='detail__attachments'>
          {pendingImages.map((item) => (
            <View key={item.key} className='detail__attachment'>
              <Image className='detail__attachment-img' src={item.path} mode='aspectFill' />
              {item.uploading ? (
                <View className='detail__attachment-mask'>
                  <Text className='detail__attachment-mask-text'>上传中</Text>
                </View>
              ) : null}
              <View
                className='detail__attachment-remove'
                onClick={() => handleRemoveImage(item)}
              >
                <Text className='detail__attachment-remove-text'>×</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View className='detail__composer'>
        <View className='detail__attach' onClick={() => void handleChooseImage()}>
          <Text className='detail__attach-icon'>+</Text>
        </View>
        <Textarea
          className='detail__composer-input'
          value={commentDraft}
          placeholder='写评论…'
          placeholderClass='input-placeholder'
          autoHeight
          maxlength={4000}
          adjustPosition
          cursorSpacing={24}
          onInput={(event) => setCommentDraft(event.detail.value)}
        />
        <View
          className={`detail__send ${commentDraft.trim() ? 'is-active' : ''} ${
            createComment.isPending ? 'is-pending' : ''
          }`}
          onClick={handleSendComment}
        >
          <Text className='detail__send-text'>{createComment.isPending ? '…' : '发送'}</Text>
        </View>
      </View>

      <OptionSheet
        visible={sheet === 'status'}
        title='变更状态'
        options={statusOptions}
        onSelect={handleSheetSelect}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'priority'}
        title='设置优先级'
        options={priorityOptions}
        onSelect={handleSheetSelect}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'assignee'}
        title='指派负责人'
        subtitle='成员、智能体或小队'
        options={assigneeOptions}
        onSelect={handleSheetSelect}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'project'}
        title='所属项目'
        options={projectOptions}
        onSelect={handleSheetSelect}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={tocOpen}
        title='快速定位'
        subtitle='跳到描述中的标题或评论区'
        options={[
          ...headings.map((heading) => ({
            key: heading.id,
            label: `${'　'.repeat(Math.max(0, heading.level - 1))}${heading.label}`,
          })),
          { key: 'comments', label: '评论与动态' },
        ]}
        onSelect={(key) => {
          setTocOpen(false)
          setScrollTarget(key)
          setTimeout(() => setScrollTarget(''), 400)
        }}
        onClose={() => setTocOpen(false)}
      />
    </View>
  )
}

function MarkdownBody({ blocks }: { blocks: MarkdownBlock[] }) {
  return (
    <View className='detail__markdown'>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return (
              <View key={index} id={block.id} className='detail__md-heading'>
                <Text className={`detail__md-h detail__md-h${block.level || 3}`}>
                  {block.text}
                </Text>
              </View>
            )
          case 'code':
            return (
              <View key={index} className='detail__md-code'>
                <Text className='detail__md-code-text'>{block.text}</Text>
              </View>
            )
          case 'list':
            return (
              <Text key={index} className='detail__md-li'>
                • {block.text}
              </Text>
            )
          case 'quote':
            return (
              <Text key={index} className='detail__md-quote'>
                {block.text}
              </Text>
            )
          case 'space':
            return <View key={index} className='detail__md-space' />
          default:
            return (
              <Text key={index} className='detail__md-p'>
                {block.text}
              </Text>
            )
        }
      })}
    </View>
  )
}

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  if (!isCommentEntry(entry)) {
    return (
      <View className='timeline__activity'>
        <View className='timeline__activity-dot' />
        <Text className='timeline__activity-text'>
          {entry.actor_name ? `${entry.actor_name} ` : ''}
          {activityLabel(entry)}
        </Text>
        <Text className='timeline__time'>{formatRelativeTime(entry.created_at)}</Text>
      </View>
    )
  }

  const content = entry.content?.trim() || (entry.deleted_at ? '该评论已删除' : '')
  const attachments: Attachment[] = entry.attachments ?? []
  const imageUrls = attachments
    .filter((attachment) => attachment.content_type?.startsWith('image/'))
    .map((attachment) => attachment.markdown_url || attachment.url || attachment.download_url)
    .filter((url): url is string => Boolean(url))

  return (
    <View className='timeline__comment'>
      <Avatar src={entry.actor_avatar_url} name={entry.actor_name || '成员'} size='sm' />
      <View className='timeline__comment-body'>
        <View className='timeline__comment-head'>
          <Text className='timeline__comment-author'>{entry.actor_name || '成员'}</Text>
          <Text className='timeline__time'>{formatRelativeTime(entry.created_at)}</Text>
        </View>
        <Text className='timeline__comment-content'>{content}</Text>
        {attachments.length > 0 ? (
          <View className='timeline__attachments'>
            {attachments.map((attachment) => {
              const src =
                attachment.markdown_url || attachment.url || attachment.download_url || ''
              const isImage = Boolean(
                attachment.content_type?.startsWith('image/') && src,
              )
              if (isImage) {
                return (
                  <Image
                    key={attachment.id}
                    className='timeline__attachment-image'
                    src={src}
                    mode='widthFix'
                    onClick={() =>
                      void Taro.previewImage({ urls: imageUrls, current: src })
                    }
                  />
                )
              }
              return (
                <Text key={attachment.id} className='timeline__attachment-file'>
                  📎 {attachment.filename || '附件'}
                </Text>
              )
            })}
          </View>
        ) : null}
      </View>
    </View>
  )
}

/**
 * Keeps the detail view inside the visual viewport while the H5 keyboard is
 * open. Without this the composer sits behind the keyboard on mobile Safari /
 * Chrome and typing looks broken.
 */
function useKeyboardViewport(): number | null {
  const [height, setHeight] = useState<number | null>(null)

  useEffect(() => {
    if (process.env.TARO_ENV !== 'h5') return
    if (typeof window === 'undefined' || !window.visualViewport) return

    const viewport = window.visualViewport
    const update = () => {
      // Only shrink for the keyboard, not for browser chrome / URL bar.
      const keyboardOpen = window.innerHeight - viewport.height > 120
      setHeight(keyboardOpen ? viewport.height : null)
    }

    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    update()
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])

  return height
}
