import { request } from './http'
import type { ListResult } from './types'

export function listFeed(cursor?: string, limit = 10): Promise<ListResult> {
  const q = new URLSearchParams()
  if (cursor) q.set('cursor', cursor)
  q.set('limit', String(limit))
  return request<ListResult>(`/feed?${q.toString()}`)
}
