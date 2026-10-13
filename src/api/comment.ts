// 评论接口，与后端 /api/v1/videos/:id/comments、/api/v1/comments/:comment_id 对齐
import { request } from './http'
import type { CommentListResult } from './types'

// 评论列表（公开，游标分页）
export async function listComments(videoId: number, cursor: string, limit = 20): Promise<CommentListResult> {
  const q = new URLSearchParams()
  if (cursor) q.set('cursor', cursor)
  q.set('limit', String(limit))
  return request<CommentListResult>(`/videos/${videoId}/comments?${q.toString()}`)
}

// 发布评论（需登录）
export async function publishComment(videoId: number, content: string): Promise<void> {
  await request(`/videos/${videoId}/comments`, { method: 'POST', body: { content } })
}

// 删除评论（仅视频创作者或评论者本人，需登录）
export async function deleteComment(commentId: number): Promise<void> {
  await request(`/comments/${commentId}`, { method: 'DELETE' })
}
