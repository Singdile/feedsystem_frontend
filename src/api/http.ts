// HTTP 封装：统一信封处理、token 附加、401 自动刷新并重试
import type { TokenPair } from './types'

export const API_BASE = '/api/v1'

const ACCESS_KEY = 'access_token'
const REFRESH_KEY = 'refresh_token'

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY)
}

export function saveTokens(t: TokenPair): void {
  localStorage.setItem(ACCESS_KEY, t.access_token)
  localStorage.setItem(REFRESH_KEY, t.refresh_token)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}

// 解析 JWT payload，取 account_id / username
export function decodeToken(token: string): { account_id: number; username: string } | null {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')
    const payload = JSON.parse(decodeURIComponent(escape(atob(b64))))
    return { account_id: payload.account_id, username: payload.username }
  } catch {
    return null
  }
}

let refreshPromise: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  const rt = getRefreshToken()
  if (!rt) return false
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: rt }),
  })
  const body = await res.json().catch(() => null)
  if (!body || body.code !== 0 || !body.data?.[0]) return false
  saveTokens(body.data[0] as TokenPair)
  return true
}

interface RequestOpts {
  method?: string
  body?: unknown
  auth?: boolean // 默认 true；仅登录/注册/refresh 传 false
  isForm?: boolean // FormData，不设 Content-Type
}

export async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const { method = 'GET', body, auth = true, isForm = false } = opts

  async function doFetch(): Promise<Response> {
    const headers: Record<string, string> = {}
    if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json'
    const token = getAccessToken()
    if (auth && token) headers['Authorization'] = `Bearer ${token}`
    return fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? (isForm ? (body as BodyInit) : JSON.stringify(body)) : undefined,
    })
  }

  let res = await doFetch()

  // 401：尝试刷新一次并重试原请求
  if (res.status === 401 && auth) {
    if (!refreshPromise) {
      refreshPromise = tryRefresh().finally(() => {
        refreshPromise = null
      })
    }
    if (await refreshPromise) {
      res = await doFetch()
    } else {
      clearTokens()
      window.dispatchEvent(new CustomEvent('auth:expired'))
      throw new Error('登录已过期，请重新登录')
    }
  }

  const json = await res.json().catch(() => ({ code: res.status, msg: '请求失败', data: [] as unknown[] }))
  if (json.code !== 0) {
    let msg: string
    // 后端限流：HTTP 429 + {"error":"too many requests"}，非标准信封
    if (res.status === 429) {
      msg = '操作太频繁，请稍后再试'
    } else {
      msg = typeof json.msg === 'string' && json.msg ? json.msg : `请求失败（${res.status}）`
    }
    throw new Error(msg)
  }
  return json.data[0] as T
}
