import { request } from './http'
import type { TokenPair } from './types'

export function login(username: string, password: string): Promise<TokenPair> {
  return request<TokenPair>('/auth/login', { method: 'POST', body: { username, password }, auth: false })
}

export function register(username: string, password: string): Promise<void> {
  return request<void>('/users', { method: 'POST', body: { username, password }, auth: false })
}

export function logout(refreshToken: string): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST', body: { refresh_token: refreshToken } })
}
