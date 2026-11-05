import { getApiClient } from '../index'
import type { Agent, ListProjectsResponse, Member, Project, Squad, Workspace } from '../types'

export function listWorkspaces(): Promise<Workspace[]> {
  return getApiClient().get<Workspace[]>('/api/workspaces')
}

export function listMembers(workspaceId: string): Promise<Member[]> {
  return getApiClient().get<Member[]>(`/api/workspaces/${workspaceId}/members`)
}

export function listProjects(): Promise<ListProjectsResponse> {
  return getApiClient().get<ListProjectsResponse>('/api/projects')
}

export function getProject(id: string): Promise<Project> {
  return getApiClient().get<Project>(`/api/projects/${id}`)
}

export function listAgents(): Promise<Agent[]> {
  return getApiClient().get<Agent[]>('/api/agents')
}

export function listSquads(): Promise<Squad[]> {
  return getApiClient().get<Squad[]>('/api/squads')
}
