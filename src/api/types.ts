// 与后端 DTO 对齐的类型（信封 data 恒为数组，负载取 data[0]）

export interface Author {
  id: number
  username: string
}

export interface VideoView {
  id: number
  title: string
  description?: string
  author: Author
  play_url: string
  cover_url?: string
  created_at: string
}

export interface ListResult {
  items: VideoView[]
  next_cursor: string
}

export interface InitResp {
  upload_id: string
  part_urls: string[]
}

export interface StatusResp {
  uploaded_parts: number[]
  total_parts: number
}

export interface CompleteResp {
  video_key: string
}

export interface CoverResp {
  cover_key: string
  preview_url: string
}

export interface PublishResp {
  id: number
  title: string
  description?: string
  author: Author
  video_key: string
  cover_key?: string
  created_at: string
}

export interface TokenPair {
  access_token: string
  refresh_token: string
}
