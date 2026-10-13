// 关注（social）接口，与后端 /api/v1/social/* 对齐（均需登录）
import { request } from './http'

export interface FollowedListResult {
  followed: boolean
}

// 关注博主（query: vlogger_id）
export async function follow(vloggerId: number): Promise<void> {
  await request(`/social/follow?vlogger_id=${vloggerId}`, { method: 'POST' })
}

// 取消关注博主
export async function unfollow(vloggerId: number): Promise<void> {
  await request(`/social/unfollow?vlogger_id=${vloggerId}`, { method: 'POST' })
}

// 是否已关注某博主
export async function isFollowed(vloggerId: number): Promise<boolean> {
  const data = await request<FollowedListResult>(`/social/is-followed?vlogger_id=${vloggerId}`, {
    method: 'POST',
  })
  return data.followed
}

// 关注/粉丝列表项：后端返回 Profile（含 username），空列表时为 null 需归一化
export interface SocialUser {
  id: number
  username: string
}

// 我的粉丝列表（后端返回 Profile[]，空为 null → 归一化为 []）
export async function listFollowers(): Promise<SocialUser[]> {
  const data = await request<{ followers: SocialUser[] | null }>('/social/followers')
  return data.followers ?? []
}

// 我关注的博主列表（后端返回 Profile[]，空为 null → 归一化为 []）
export async function listFollowing(): Promise<SocialUser[]> {
  const data = await request<{ vloggers: SocialUser[] | null }>('/social/following')
  return data.vloggers ?? []
}

export interface SocialCounts {
  followers: number
  following: number
}

// 我的粉丝数 / 关注数（后端键为 followers_Cnt / following_Cnt，前端归一化）
export async function getSocialCounts(): Promise<SocialCounts> {
  const data = await request<{ followers_Cnt: number; following_Cnt: number }>('/social/counts')
  return { followers: data.followers_Cnt, following: data.following_Cnt }
}
