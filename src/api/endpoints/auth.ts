import { getApiClient } from '../index'
import type { AppConfig, LoginResponse, User } from '../types'

export async function sendCode(email: string): Promise<void> {
  await getApiClient().post('/auth/send-code', { email })
}

export async function verifyCode(email: string, code: string): Promise<LoginResponse> {
  return getApiClient().post<LoginResponse>('/auth/verify-code', { email, code })
}

export async function logout(): Promise<void> {
  await getApiClient().post('/auth/logout')
}

export async function getMe(): Promise<User> {
  return getApiClient().get<User>('/api/me')
}

export async function updateMe(
  data: Partial<Pick<User, 'name' | 'avatar_url' | 'language' | 'timezone'>>,
): Promise<User> {
  return getApiClient().patch<User>('/api/me', data)
}

export async function getConfig(): Promise<AppConfig> {
  return getApiClient().get<AppConfig>('/api/config')
}

export async function refreshSession(): Promise<{ token?: string }> {
  return getApiClient().post<{ token?: string }>('/api/auth/refresh')
}
