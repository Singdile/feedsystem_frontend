import { request } from './http'
import type { ListResult, VideoView } from './types'

export function listFeed(cursor?: string, limit = 10): Promise<ListResult> {
  const q = new URLSearchParams()
  if (cursor) q.set('cursor', cursor)
  q.set('limit', String(limit))
  return request<ListResult>(`/feed?${q.toString()}`)
}

export interface PopularResult {
  items: VideoView[]
  as_of: number
  offset: number
  has_more: boolean
}

// 热度榜（offset 分页，非游标）
export async function listPopular(opts: { asof?: number; offset?: number; limit?: number } = {}): Promise<PopularResult> {
  const q = new URLSearchParams()
  if (opts.asof) q.set('asof', String(opts.asof))
  if (opts.offset) q.set('offset', String(opts.offset))
  q.set('limit', String(opts.limit || 12))
  return request<PopularResult>(`/feed/popular?${q.toString()}`)
}
