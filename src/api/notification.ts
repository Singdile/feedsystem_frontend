// 通知接口，与后端 /api/v1/notifications 对齐
// 注意：后端全部用 query `token` 认证（EventSource 无法带 header），非 Bearer
import { getAccessToken, request } from './http'
import type { NotificationListResult } from './types'

function withToken(q: URLSearchParams): string {
  const t = getAccessToken()
  if (t) q.set('token', t)
  return q.toString()
}

// 历史通知列表（游标分页）
export async function listNotifications(cursor: string, limit = 20): Promise<NotificationListResult> {
  const q = new URLSearchParams()
  if (cursor) q.set('cursor', cursor)
  q.set('limit', String(limit))
  return request<NotificationListResult>(`/notifications/list?${withToken(q)}`)
}

// 未读数量（红点）
export async function getUnreadCount(): Promise<number> {
  const q = new URLSearchParams()
  const data = await request<{ count: number }>(`/notifications/unread-count?${withToken(q)}`)
  return data.count
}

// 标记已读：id 为空/0 → 全部已读；指定 id → 单条已读
export async function markNotificationsRead(id = 0): Promise<void> {
  const q = new URLSearchParams()
  await request(`/notifications/mark-read?${withToken(q)}`, { method: 'POST', body: { id } })
}

// 实时推送：SSE 流 URL（EventSource 用 query token）
export function notificationStreamUrl(): string {
  const t = getAccessToken()
  const q = new URLSearchParams()
  if (t) q.set('token', t)
  return `/api/v1/notifications/stream?${q.toString()}`
}
