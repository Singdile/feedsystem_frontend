import { defineStore } from 'pinia'
import * as authApi from '../api/auth'
import { clearTokens, decodeToken, getAccessToken, getRefreshToken, saveTokens } from '../api/http'
import type { TokenPair } from '../api/types'

interface Account {
  id: number
  username: string
}

export const useAuthStore = defineStore('auth', {
  state: () => {
    const token = getAccessToken()
    const info = token ? decodeToken(token) : null
    return {
      account: info ? ({ id: info.account_id, username: info.username } as Account) : null,
    }
  },
  getters: {
    isLoggedIn: (s) => !!s.account,
  },
  actions: {
    applyTokens(t: TokenPair) {
      saveTokens(t)
      const info = decodeToken(t.access_token)
      this.account = info ? { id: info.account_id, username: info.username } : null
    },
    async login(username: string, password: string) {
      const tokens = await authApi.login(username, password)
      this.applyTokens(tokens)
    },
    async register(username: string, password: string) {
      await authApi.register(username, password)
      await this.login(username, password)
    },
    async logout() {
      const rt = getRefreshToken()
      try {
        if (rt) await authApi.logout(rt)
      } finally {
        clearTokens()
        this.account = null
      }
    },
    clear() {
      clearTokens()
      this.account = null
    },
  },
})
