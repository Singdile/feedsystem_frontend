import { request } from './http'
import type { CompleteResp, CoverResp, InitResp, ListResult, PublishResp, StatusResp, VideoView } from './types'

export function initVideo(payload: { file_name: string; file_size: number; file_hash: string }): Promise<InitResp> {
  return request<InitResp>('/uploads/videos/init', { method: 'POST', body: payload })
}

export function getUploadStatus(uploadId: string): Promise<StatusResp> {
  return request<StatusResp>(`/uploads/videos/${uploadId}/status`)
}

export function completeUpload(uploadId: string): Promise<CompleteResp> {
  return request<CompleteResp>(`/uploads/videos/${uploadId}/complete`, { method: 'POST' })
}

export function uploadCover(file: File): Promise<CoverResp> {
  const fd = new FormData()
  fd.append('file', file)
  return request<CoverResp>('/uploads/videos/covers', { method: 'POST', body: fd, isForm: true })
}

export function publish(payload: { title: string; description?: string; video_key: string; cover_key: string }): Promise<PublishResp> {
  return request<PublishResp>('/uploads/videos/publish', { method: 'POST', body: payload })
}

export function getVideo(id: number | string): Promise<VideoView> {
  return request<VideoView>(`/videos/${id}`)
}

export function listVideos(params: { author_id?: number; cursor?: string; limit?: number }): Promise<ListResult> {
  const q = new URLSearchParams()
  if (params.author_id) q.set('author_id', String(params.author_id))
  if (params.cursor) q.set('cursor', params.cursor)
  if (params.limit) q.set('limit', String(params.limit))
  const qs = q.toString()
  return request<ListResult>(`/videos${qs ? `?${qs}` : ''}`)
}

export function deleteVideo(id: number): Promise<void> {
  return request<void>(`/videos/${id}`, { method: 'DELETE' })
}
