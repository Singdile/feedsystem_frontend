// 视频点赞/踩（rating）接口，与后端 /api/v1/videos/:id 相关端点对齐
import { request } from './http'
import type { VideoView } from './types'

export interface RatingCounts {
  liked_count: number
  disliked_count: number
}

// 后端 liked-videos 返回扁平模型（author_id/username，无 play/cover），需归一化
interface LikedVideo {
  id: number
  author_id: number
  username: string
  title: string
  description?: string
  created_at: string
  liked_count: number
  disliked_count: number
  comment_count: number
}

export interface LikedListResult {
  videos: VideoView[]
  next_cursor: string
}

// 查询当前用户对某视频的点赞状态：1=like, -1=dislike, 0=none（需登录）
export async function getRating(videoId: number): Promise<number> {
  const data = await request<{ stat: number }>(`/videos/${videoId}/rating`)
  return data.stat
}

// 设置点赞状态（需登录）
export async function setRating(videoId: number, action: 'like' | 'dislike' | 'none'): Promise<number> {
  const data = await request<{ stat: number }>(`/videos/${videoId}/rating`, {
    method: 'POST',
    body: { action },
  })
  return data.stat
}

// 查询某视频的赞/踩计数（需登录）
export async function getRatingCounts(videoId: number): Promise<RatingCounts> {
  return request<RatingCounts>(`/videos/${videoId}/video`)
}

// 我赞过的视频（需登录，游标分页）
export async function listLikedVideos(cursor: string, limit = 12): Promise<LikedListResult> {
  const q = new URLSearchParams()
  if (cursor) q.set('cursor', cursor)
  q.set('limit', String(limit))
  const data = await request<{ videos: LikedVideo[]; next_cursor: string }>(
    `/videos/me/liked-videos?${q.toString()}`,
  )
  return {
    next_cursor: data.next_cursor,
    videos: data.videos.map((v) => ({
      id: v.id,
      title: v.title,
      description: v.description,
      author: { id: v.author_id, username: v.username },
      play_url: '',
      cover_url: undefined,
      liked_count: v.liked_count,
      disliked_count: v.disliked_count,
      comment_count: v.comment_count,
      status: 0,
      created_at: v.created_at,
    })),
  }
}
