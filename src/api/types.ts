/**
 * Wire types for the Multica API.
 *
 * These mirror `packages/core/types` in the Multica monorepo. Status keys and
 * priorities are open strings on the server (workspaces can define custom
 * statuses), so the client always has a fallback label rather than assuming
 * the seven built-ins.
 */

export type IssueStatus = string
export type IssuePriority = 'none' | 'low' | 'medium' | 'high' | 'urgent'
export type IssueAssigneeType = 'member' | 'agent' | 'squad'
export type IssueStatusCategory = 'unstarted' | 'started' | 'done' | 'closed'

export interface User {
  id: string
  name: string
  email: string
  avatar_url: string | null
  onboarded_at?: string | null
  language?: string | null
  profile_description?: string
  timezone?: string | null
  created_at?: string
  updated_at?: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  description: string | null
  issue_prefix: string
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Member {
  id: string
  workspace_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  created_at: string
  name: string
  email: string
  avatar_url: string | null
}

export interface Project {
  id: string
  workspace_id: string
  title: string
  description: string | null
  icon: string | null
  status: 'planned' | 'in_progress' | 'paused' | 'completed' | 'cancelled' | string
  priority: 'urgent' | 'high' | 'medium' | 'low' | 'none' | string
  lead_type: 'member' | 'agent' | null
  lead_id: string | null
  start_date: string | null
  due_date: string | null
  created_at: string
  updated_at: string
  issue_count: number
  done_count: number
  resource_count: number
}

export interface Agent {
  id: string
  workspace_id: string
  runtime_id: string
  runtime_bound?: boolean
  name: string
  description: string
  avatar_url: string | null
  visibility?: string
  archived_at?: string | null
  created_at: string
  updated_at: string
}

export interface Squad {
  id: string
  workspace_id: string
  name: string
  description: string
  avatar_url: string | null
  leader_id: string
  member_count?: number
  created_at: string
  updated_at: string
  archived_at?: string | null
}

export interface Label {
  id: string
  workspace_id?: string
  name: string
  color: string
}

export interface Issue {
  id: string
  workspace_id: string
  number: number
  identifier: string
  title: string
  description: string | null
  status: IssueStatus
  status_category?: IssueStatusCategory | string
  status_name?: string
  priority: IssuePriority | string
  assignee_type: IssueAssigneeType | null
  assignee_id: string | null
  creator_type: string
  creator_id: string
  parent_issue_id: string | null
  project_id: string | null
  position: number
  stage: number | null
  start_date: string | null
  due_date: string | null
  metadata: Record<string, string | number | boolean>
  properties?: Record<string, unknown>
  labels?: Label[]
  created_at: string
  updated_at: string
  revision?: number
  last_activity_at?: string | null
}

export interface Comment {
  id: string
  issue_id: string
  author_type: 'member' | 'agent' | 'system' | string
  author_id: string
  content: string
  type: 'comment' | 'status_change' | 'progress_update' | 'system' | string
  parent_id: string | null
  reactions?: { id: string; emoji: string; actor_type: string; actor_id: string }[]
  attachments?: Attachment[]
  created_at: string
  updated_at: string
  revision?: number
  deleted_at?: string | null
  resolved_at?: string | null
}

export interface Attachment {
  id: string
  filename?: string
  content_type?: string
  size_bytes?: number
  url?: string
  download_url?: string
  /** Durable URL safe to embed in content / render as an image. */
  markdown_url?: string
}

/** One row of `GET /api/issues/:id/timeline` (oldest first). */
export interface TimelineEntry {
  type: 'activity' | 'comment'
  id: string
  actor_type: string
  actor_id: string
  created_at: string
  actor_name?: string
  actor_avatar_url?: string
  action?: string
  details?: Record<string, unknown>
  content?: string
  parent_id?: string | null
  updated_at?: string
  revision?: number
  comment_type?: string
  deleted_at?: string | null
  reactions?: { id: string; emoji: string; actor_type: string; actor_id: string }[]
  attachments?: Attachment[]
}

export type InboxItemType =
  | 'issue_assigned'
  | 'issue_subscribed'
  | 'unassigned'
  | 'assignee_changed'
  | 'status_changed'
  | 'priority_changed'
  | 'start_date_changed'
  | 'due_date_changed'
  | 'new_comment'
  | 'mentioned'
  | 'review_requested'
  | 'task_completed'
  | 'task_failed'
  | 'agent_blocked'
  | 'agent_completed'
  | 'reaction_added'
  | 'quick_create_done'
  | 'quick_create_failed'
  | 'quick_create_unconfirmed'
  | 'autopilot_paused'
  | 'autopilot_quota_exceeded'
  | 'children_done'
  | (string & {})

export type InboxSeverity = 'action_required' | 'attention' | 'info'

export interface InboxItem {
  id: string
  workspace_id: string
  recipient_type: 'member' | 'agent' | string
  recipient_id: string
  actor_type: 'member' | 'agent' | 'system' | null
  actor_id: string | null
  type: InboxItemType
  severity: InboxSeverity
  issue_id: string | null
  title: string
  body: string | null
  issue_status: IssueStatus | null
  issue_priority: IssuePriority | null
  read: boolean
  archived: boolean
  created_at: string
  details: Record<string, string> | null
}

export interface InboxWorkspaceUnread {
  workspace_id: string
  count: number
}

export interface ListIssuesResponse {
  issues: Issue[]
  total: number
}

export interface ListProjectsResponse {
  projects: Project[]
  total: number
}

export interface ListIssuesParams {
  limit?: number
  offset?: number
  q?: string
  status?: IssueStatus
  statuses?: IssueStatus[]
  priority?: IssuePriority
  priorities?: IssuePriority[]
  assignee_id?: string
  assignee_ids?: string[]
  assignee_types?: IssueAssigneeType[]
  creator_id?: string
  project_id?: string
  project_ids?: string[]
  label_ids?: string[]
  open_only?: boolean
  top_level_only?: boolean
  sort_by?: 'position' | 'status' | 'priority' | 'title' | 'created_at' | 'updated_at' | 'last_activity' | 'due_date'
  sort_direction?: 'asc' | 'desc'
}

export interface CreateIssueRequest {
  title: string
  description?: string
  status?: IssueStatus
  priority?: IssuePriority
  assignee_type?: IssueAssigneeType
  assignee_id?: string
  parent_issue_id?: string
  project_id?: string
  start_date?: string
  due_date?: string
  label_ids?: string[]
  /** Ask the backend to create the issue through an agent instead. */
  attachment_ids?: string[]
}

export interface QuickCreateRequest {
  prompt: string
  agent_id?: string
  squad_id?: string
  priority?: IssuePriority
  due_date?: string
  project_id?: string | null
  parent_issue_id?: string | null
}

export interface UpdateIssueRequest {
  title?: string
  title_base?: string
  description?: string
  description_base?: string
  status?: IssueStatus
  priority?: IssuePriority
  assignee_type?: IssueAssigneeType | null
  assignee_id?: string | null
  project_id?: string | null
  parent_issue_id?: string | null
  start_date?: string | null
  due_date?: string | null
  expected_revision?: number
}

export interface LoginResponse {
  token: string
  user: User
}

export interface AppConfig {
  allow_signup: boolean
  server_version: string
  feature_flags?: Record<string, boolean>
}
