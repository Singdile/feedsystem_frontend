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
  liked_count: number
  disliked_count: number
  comment_count: number
  status: number // 当前用户评价：1=赞 -1=踩 0=未评（feed 登录态盖章）
  hash_tags?: string[]
  created_at: string
}

// GET /users/:id/profile（公开）
export interface UserProfile {
  profile: {
    id: number
    username: string
    bio?: string
  }
  follower_count: number
  vlogger_count: number // 关注数
  video_count: number
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

export interface Comment {
  id: number
  video_id: number
  author_id: number // 视频创作者 id
  account_id: number // 评论者 id
  user_name: string
  content: string
  created_at: string
}

export interface CommentListResult {
  comments: Comment[]
  cursor: string
}

// 通知（like/comment/follow/mention）
export interface Notification {
  id: number
  recipient_id: number
  sender_id: number
  type: 'like' | 'comment' | 'follow' | 'mention' | string
  target_id: number
  content: string
  is_read: boolean
  created_at: string
}

export interface NotificationListResult {
  notifications: Notification[]
  next_cursor: string
}
