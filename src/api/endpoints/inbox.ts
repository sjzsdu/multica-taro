import { getApiClient } from '../index'
import type { InboxItem, InboxWorkspaceUnread } from '../types'

/** Unread + recent notifications for the active workspace, newest first. */
export function listInbox(): Promise<InboxItem[]> {
  return getApiClient().get<InboxItem[]>('/api/inbox')
}

export function listArchivedInbox(): Promise<InboxItem[]> {
  return getApiClient().get<InboxItem[]>('/api/inbox/archived')
}

export function getUnreadCount(): Promise<{ count: number }> {
  return getApiClient().get<{ count: number }>('/api/inbox/unread-count')
}

export function getUnreadSummary(): Promise<InboxWorkspaceUnread[]> {
  return getApiClient().get<InboxWorkspaceUnread[]>('/api/inbox/unread-summary')
}

export function markRead(id: string): Promise<InboxItem> {
  return getApiClient().post<InboxItem>(`/api/inbox/${id}/read`)
}

export function markUnread(id: string): Promise<InboxItem> {
  return getApiClient().post<InboxItem>(`/api/inbox/${id}/unread`)
}

export function archiveItem(id: string): Promise<InboxItem> {
  return getApiClient().post<InboxItem>(`/api/inbox/${id}/archive`)
}

export function unarchiveItem(id: string): Promise<InboxItem> {
  return getApiClient().post<InboxItem>(`/api/inbox/${id}/unarchive`)
}

export function markAllRead(): Promise<{ count: number }> {
  return getApiClient().post<{ count: number }>('/api/inbox/mark-all-read')
}

export function archiveAll(): Promise<{ count: number }> {
  return getApiClient().post<{ count: number }>('/api/inbox/archive-all')
}

export function archiveAllRead(): Promise<{ count: number }> {
  return getApiClient().post<{ count: number }>('/api/inbox/archive-all-read')
}
