import { getApiClient } from '../index'
import type {
  Agent,
  Issue,
  IssuePriority,
  IssueStatus,
  ListIssuesParams,
  ListIssuesResponse,
  Project,
  Squad,
  TimelineEntry,
  CreateIssueRequest,
  UpdateIssueRequest,
} from '../types'

export function listIssues(params?: ListIssuesParams): Promise<ListIssuesResponse> {
  const client = getApiClient()
  return client.get<ListIssuesResponse>('/api/issues', {
    limit: params?.limit,
    offset: params?.offset,
    q: params?.q,
    status: params?.status,
    statuses: params?.statuses,
    priority: params?.priority,
    priorities: params?.priorities,
    assignee_id: params?.assignee_id,
    assignee_ids: params?.assignee_ids,
    assignee_types: params?.assignee_types,
    creator_id: params?.creator_id,
    project_id: params?.project_id,
    project_ids: params?.project_ids,
    label_ids: params?.label_ids,
    open_only: params?.open_only,
    top_level_only: params?.top_level_only,
    sort: params?.sort_by,
    direction: params?.sort_direction,
  })
}

export function getIssue(id: string): Promise<Issue> {
  return getApiClient().get<Issue>(`/api/issues/${id}`)
}

export function createIssue(data: CreateIssueRequest): Promise<Issue> {
  return getApiClient().post<Issue>('/api/issues', data)
}

/** Hand a one-line prompt to an agent, which creates and runs the issue. */
export function quickCreateIssue(data: {
  prompt: string
  agent_id?: string
  squad_id?: string
  priority?: IssuePriority
  due_date?: string
  project_id?: string | null
  parent_issue_id?: string | null
}): Promise<{ task_id: string }> {
  return getApiClient().post<{ task_id: string }>('/api/issues/quick-create', data)
}

export function updateIssue(id: string, data: UpdateIssueRequest): Promise<Issue> {
  return getApiClient().put<Issue>(`/api/issues/${id}`, data)
}

export function deleteIssue(id: string): Promise<void> {
  return getApiClient().delete<void>(`/api/issues/${id}`)
}

export function listComments(issueId: string) {
  return getApiClient().get(`/api/issues/${issueId}/comments`) as Promise<
    import('../types').Comment[]
  >
}

export function createComment(issueId: string, content: string): Promise<import('../types').Comment> {
  return getApiClient().post(`/api/issues/${issueId}/comments`, {
    content,
    type: 'comment',
  })
}

/** Oldest first, comments and activity interleaved. */
export function listTimeline(issueId: string): Promise<TimelineEntry[]> {
  return getApiClient().get<TimelineEntry[]>(`/api/issues/${issueId}/timeline`)
}

export function rerunIssue(issueId: string): Promise<unknown> {
  return getApiClient().post(`/api/issues/${issueId}/rerun`)
}

export type { Issue, IssueStatus, Project, Agent, Squad }
