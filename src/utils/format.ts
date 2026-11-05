import type { InboxItem, InboxItemType, IssuePriority, IssueStatus, TimelineEntry } from '@/api/types'

export interface StatusMeta {
  label: string
  color: string
  background: string
}

const BUILT_IN_STATUS: Record<string, StatusMeta> = {
  backlog: { label: '待规划', color: '#667085', background: '#F2F4F7' },
  todo: { label: '待处理', color: '#475467', background: '#F2F4F7' },
  in_progress: { label: '进行中', color: '#175CD3', background: '#EFF8FF' },
  in_review: { label: '审核中', color: '#B54708', background: '#FFFAEB' },
  done: { label: '已完成', color: '#027A48', background: '#ECFDF3' },
  blocked: { label: '受阻', color: '#B42318', background: '#FEF3F2' },
  cancelled: { label: '已取消', color: '#98A2B3', background: '#F9FAFB' },
}

const UNKNOWN_STATUS: StatusMeta = { label: '未知状态', color: '#667085', background: '#F2F4F7' }

export function statusMeta(status: IssueStatus | null | undefined, name?: string): StatusMeta {
  if (!status) return UNKNOWN_STATUS
  const builtIn = BUILT_IN_STATUS[status]
  if (builtIn) return name ? { ...builtIn, label: name } : builtIn
  return { label: name || status, color: '#344054', background: '#F2F4F7' }
}

export const STATUS_ORDER: { key: string; label: string }[] = [
  { key: 'backlog', label: '待规划' },
  { key: 'todo', label: '待处理' },
  { key: 'in_progress', label: '进行中' },
  { key: 'in_review', label: '审核中' },
  { key: 'blocked', label: '受阻' },
  { key: 'done', label: '已完成' },
  { key: 'cancelled', label: '已取消' },
]

export interface PriorityMeta {
  label: string
  short: string
  color: string
  rank: number
}

export const PRIORITY_META: Record<string, PriorityMeta> = {
  none: { label: '无优先级', short: '无', color: '#98A2B3', rank: 0 },
  low: { label: '低优先级', short: '低', color: '#2E90FA', rank: 1 },
  medium: { label: '中优先级', short: '中', color: '#F79009', rank: 2 },
  high: { label: '高优先级', short: '高', color: '#F04438', rank: 3 },
  urgent: { label: '紧急', short: '急', color: '#D92D20', rank: 4 },
}

export const PRIORITY_ORDER: IssuePriority[] = ['none', 'low', 'medium', 'high', 'urgent']

export function priorityMeta(priority: string | null | undefined): PriorityMeta {
  return PRIORITY_META[priority || 'none'] ?? PRIORITY_META.none
}

const INBOX_TYPE_LABELS: Record<string, string> = {
  issue_assigned: '分配给你',
  issue_subscribed: '你订阅的任务',
  unassigned: '取消分配',
  assignee_changed: '负责人变更',
  status_changed: '状态变更',
  priority_changed: '优先级变更',
  start_date_changed: '开始日期变更',
  due_date_changed: '截止日期变更',
  new_comment: '新评论',
  mentioned: '提到了你',
  review_requested: '请求审查',
  task_completed: '运行完成',
  task_failed: '运行失败',
  agent_blocked: '智能体受阻',
  agent_completed: '智能体已完成',
  reaction_added: '表情回应',
  quick_create_done: '快速创建完成',
  quick_create_failed: '快速创建失败',
  quick_create_unconfirmed: '快速创建待确认',
  autopilot_paused: '自动化已暂停',
  autopilot_quota_exceeded: '自动化超出额度',
  children_done: '子任务已全部结束',
}

export function inboxTypeLabel(type: InboxItemType | string): string {
  return INBOX_TYPE_LABELS[type] || '通知'
}

export function inboxAccent(item: InboxItem): string {
  if (item.severity === 'action_required') return '#F04438'
  if (item.severity === 'attention') return '#F79009'
  if (item.type === 'task_failed' || item.type === 'quick_create_failed') return '#F04438'
  if (item.type === 'task_completed' || item.type === 'agent_completed') return '#12B76A'
  return '#4C84FF'
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days === 1) return '昨天'
  if (days < 7) return `${days} 天前`
  const sameYear = date.getFullYear() === now.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return sameYear ? `${month}月${day}日` : `${date.getFullYear()}年${month}月${day}日`
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return date.getTime() < today.getTime()
}

const ACTIVITY_LABELS: Record<string, string> = {
  created: '创建了任务',
  status_changed: '更新了状态',
  priority_changed: '更新了优先级',
  assignee_changed: '更新了负责人',
  assigned: '指派了任务',
  unassigned: '移除了负责人',
  self_assigned: '指派给了自己',
  project_changed: '更新了项目',
  title_changed: '重命名了任务',
  description_updated: '更新了描述',
  due_date_changed: '更新了截止日期',
  start_date_changed: '更新了开始日期',
  label_added: '添加了标签',
  label_removed: '移除了标签',
  duplicate_marked: '标记了重复任务',
  parent_changed: '更新了父任务',
}

export function activityLabel(entry: TimelineEntry): string {
  if (entry.action) {
    if (ACTIVITY_LABELS[entry.action]) return ACTIVITY_LABELS[entry.action]
    return entry.action.replace(/_/g, ' ')
  }
  return '更新了任务'
}

export function isCommentEntry(entry: TimelineEntry): boolean {
  return entry.type === 'comment'
}

export function entryContent(entry: TimelineEntry): string {
  return entry.content?.trim() || ''
}
