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
  useIssueChildren,
  useIssueTimeline,
  useProjects,
  useUpdateIssue,
} from '@/hooks/use-api'
import type { ActorOption } from '@/hooks/use-api'
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
import { parseMarkdown } from '@/utils/markdown'
import { MarkdownBody, commentPreview } from '@/components/markdown'
import './index.scss'

type SheetKind = 'status' | 'priority' | 'assignee' | 'project' | null

interface PendingImage {
  key: string
  path: string
  id?: string
  uploading: boolean
}

interface MentionMarker {
  name: string
  fullName: string
  type: 'member' | 'agent' | 'squad'
  id: string
}

export default function IssueDetailPage() {
  const status = useAuthGuard()
  const router = useRouter()
  const issueId = router.params.id || ''

  const issueQuery = useIssue(issueId)
  const timelineQuery = useIssueTimeline(issueId)
  const childrenQuery = useIssueChildren(issueId)
  const parentId = issueQuery.data?.parent_issue_id ?? ''
  const parentQuery = useIssue(parentId)
  const updateIssue = useUpdateIssue()
  const createComment = useCreateComment(issueId)
  const projects = useProjects()
  const actors = useActors()

  const issue = issueQuery.data
  const timeline = timelineQuery.data ?? []
  const childIssues = childrenQuery.data ?? []
  const doneChildren = childIssues.filter(
    (child) => child.status === 'done' || child.status_category === 'done',
  ).length
  const parentIssue = parentQuery.data
  const commentAnchors = useMemo(
    () =>
      timeline
        .filter(
          (entry) => entry.type === 'comment' && entry.actor_type === 'member',
        )
        .map((entry) => ({
          id: `comment-${entry.id}`,
          label: `${entry.actor_name || '成员'}：${commentPreview(entry.content)}`,
        })),
    [timeline],
  )
  const commentMap = useMemo(() => {
    const map = new Map<string, TimelineEntry>()
    for (const entry of timeline) {
      if (entry.type === 'comment') map.set(entry.id, entry)
    }
    return map
  }, [timeline])
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
  const draftKey = `comment_draft_${issueId}`

  useEffect(() => {
    const saved = Taro.getStorageSync(draftKey)
    setCommentDraft(typeof saved === 'string' ? saved : '')
  }, [draftKey])

  useEffect(() => {
    if (!issueId) return
    if (commentDraft.trim()) {
      Taro.setStorageSync(draftKey, commentDraft)
    } else {
      Taro.removeStorageSync(draftKey)
    }
  }, [commentDraft, draftKey, issueId])
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [composerFocused, setComposerFocused] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: string; author: string } | null>(null)
  const [mentions, setMentions] = useState<MentionMarker[]>([])
  const mentionMatch = commentDraft.match(/(?:^|\s)@([^\s@]*)$/)
  const mentionQuery = mentionMatch ? mentionMatch[1] : null
  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return []
    const query = mentionQuery.toLowerCase()
    return actors.options
      .filter((option) => !query || option.name.toLowerCase().includes(query))
      .slice(0, 6)
  }, [mentionQuery, actors.options])

  const insertMention = (option: ActorOption) => {
    const shortName = option.name.split(/\s+/)[0]
    setCommentDraft((prev) => prev.replace(/@([^\s@]*)$/, `@${shortName} `))
    setMentions((prev) => [
      ...prev,
      { name: shortName, fullName: option.name, type: option.type, id: option.id },
    ])
  }

  const serializeMentions = (text: string): string => {
    let content = text
    for (const marker of mentions) {
      content = content.replace(
        `@${marker.name}`,
        `[@${marker.fullName}](mention://${marker.type}/${marker.id})`,
      )
    }
    return content
  }
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
        sourceType: ['album', 'camera'],
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
    const rawContent = commentDraft.trim()
    if (!rawContent || createComment.isPending) return
    if (pendingImages.some((item) => item.uploading)) {
      Taro.showToast({ title: '图片还在上传中', icon: 'none' })
      return
    }

    const attachmentIds = pendingImages
      .map((item) => item.id)
      .filter((id): id is string => Boolean(id))

    createComment.mutate(
      {
        content: serializeMentions(rawContent),
        attachmentIds,
        parentId: replyTo?.id,
      },
      {
        onError: notifyError,
        onSuccess: () => {
          Taro.removeStorageSync(draftKey)
          setCommentDraft('')
          setPendingImages([])
          setMentions([])
          setReplyTo(null)
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
          headings.length > 0 || commentAnchors.length > 0 ? (
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
          {parentIssue ? (
            <KeyValueRow
              label='父任务'
              onClick={() =>
                void Taro.navigateTo({
                  url: `/pages/issue-detail/index?id=${parentIssue.id}`,
                })
              }
            >
              <Text className='detail__value'>{parentIssue.identifier}</Text>
            </KeyValueRow>
          ) : null}
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

        {childIssues.length > 0 ? (
          <View className='detail__card detail__card--block'>
            <View className='detail__section-head'>
              <Text className='detail__section-title'>子任务</Text>
              <Text className='detail__section-count'>
                {doneChildren}/{childIssues.length}
              </Text>
            </View>
            <View className='detail__children'>
              {childIssues.map((child) => (
                <View
                  key={child.id}
                  className='detail__child'
                  onClick={() =>
                    void Taro.navigateTo({
                      url: `/pages/issue-detail/index?id=${child.id}`,
                    })
                  }
                >
                  <StatusBadge status={child.status} name={child.status_name} compact />
                  <Text className='detail__child-id'>{child.identifier}</Text>
                  <Text className='detail__child-title'>{child.title}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

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
              <TimelineRow
                key={`${entry.type}-${entry.id}`}
                entry={entry}
                parent={entry.parent_id ? commentMap.get(entry.parent_id) : undefined}
                onReply={(target) =>
                  setReplyTo({
                    id: target.id,
                    author: target.actor_name || '成员',
                  })
                }
              />
            ))}
          </View>
        </View>

        <View className='detail__scroll-space' />
      </ScrollView>

      <View className='detail__composer-area'>
        {replyTo ? (
          <View className='detail__reply-bar'>
            <Text className='detail__reply-bar-text'>回复 {replyTo.author}</Text>
            <Text
              className='detail__reply-bar-cancel'
              onClick={() => setReplyTo(null)}
            >
              取消
            </Text>
          </View>
        ) : null}

        {mentionCandidates.length > 0 ? (
          <ScrollView scrollX className='detail__mention-bar'>
            {mentionCandidates.map((option) => (
              <View
                key={option.key}
                className='detail__mention'
                onClick={() => insertMention(option)}
              >
                <Avatar src={option.avatarUrl} name={option.name} size='xs' />
                <Text className='detail__mention-name'>{option.name}</Text>
                <Text className='detail__mention-hint'>{option.hint}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}

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
            <View className='detail__attach-icon'>
              <View className='detail__attach-peak' />
            </View>
          </View>
          <View
            className={`detail__input-wrap ${composerFocused ? 'is-focused' : ''}`}
          >
            <Textarea
              className='detail__composer-input'
              value={commentDraft}
              placeholder='写评论…'
              placeholderClass='input-placeholder'
              autoHeight
              maxlength={4000}
              adjustPosition
              cursorSpacing={24}
              onFocus={() => setComposerFocused(true)}
              onBlur={() => setComposerFocused(false)}
              onInput={(event) => setCommentDraft(event.detail.value)}
            />
          </View>
          <View
            className={`detail__send ${
              commentDraft.trim() && !createComment.isPending ? 'is-active' : ''
            } ${createComment.isPending ? 'is-pending' : ''}`}
            onClick={handleSendComment}
          >
            <Text className='detail__send-text'>
              {createComment.isPending ? '…' : '发送'}
            </Text>
          </View>
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
        subtitle='跳到描述标题或成员评论'
        options={[
          ...headings.map((heading) => ({
            key: heading.id,
            label: `${'　'.repeat(Math.max(0, heading.level - 1))}${heading.label}`,
          })),
          { key: 'comments', label: '评论区' },
          ...commentAnchors.map((anchor) => ({
            key: anchor.id,
            label: anchor.label,
          })),
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


function TimelineRow({
  entry,
  parent,
  onReply,
}: {
  entry: TimelineEntry
  parent?: TimelineEntry
  onReply?: (entry: TimelineEntry) => void
}) {
  const content = entry.content?.trim() || (entry.deleted_at ? '该评论已删除' : '')
  const commentBlocks = useMemo(() => parseMarkdown(content).blocks, [content])

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

  const attachments: Attachment[] = entry.attachments ?? []
  const imageUrls = attachments
    .filter((attachment) => attachment.content_type?.startsWith('image/'))
    .map((attachment) => attachment.markdown_url || attachment.url || attachment.download_url)
    .filter((url): url is string => Boolean(url))

  return (
    <View
      id={`comment-${entry.id}`}
      className={`timeline__comment ${parent ? 'is-reply' : ''}`}
    >
      <Avatar src={entry.actor_avatar_url} name={entry.actor_name || '成员'} size='sm' />
      <View className='timeline__comment-body'>
        <View className='timeline__comment-head'>
          <Text className='timeline__comment-author'>{entry.actor_name || '成员'}</Text>
          {parent ? (
            <Text className='timeline__reply-to'>
              回复 {parent.actor_name || '成员'}
            </Text>
          ) : null}
          <Text className='timeline__time'>{formatRelativeTime(entry.created_at)}</Text>
          {onReply ? (
            <Text className='timeline__reply' onClick={() => onReply(entry)}>
              回复
            </Text>
          ) : null}
        </View>
        <View className='timeline__comment-content'>
          <MarkdownBody blocks={commentBlocks} withAnchors={false} compact />
        </View>
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
                    lazyLoad
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
