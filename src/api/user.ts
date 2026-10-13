// 用户查询接口，与后端 /api/v1/users 对齐
import { request } from './http'
import type { UserProfile } from './types'

// 按 ID 查用户（关注/粉丝列表 id → 用户名，需登录）
export async function getUser(id: number): Promise<{ id: number; username: string }> {
  return request<{ id: number; username: string }>(`/users/${id}`)
}

// 批量查用户，保持输入顺序，单个失败返回 null
export async function getUsers(ids: number[]): Promise<( { id: number; username: string } | null )[]> {
  return Promise.all(ids.map((id) => getUser(id).catch(() => null)))
}

// 公开作者主页：简介 + 粉丝/关注/作品数
export async function getProfile(id: number): Promise<UserProfile> {
  return request<UserProfile>(`/users/${id}/profile`)
}
