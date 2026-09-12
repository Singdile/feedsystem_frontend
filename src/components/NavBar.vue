<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

async function onLogout() {
  await auth.logout()
  router.push({ name: 'feed' })
}
</script>

<template>
  <header class="nav">
    <div class="container nav-inner">
      <router-link to="/" class="brand" aria-label="FeedSystem 首页">
        <span class="brand-dot" aria-hidden="true"></span>
        <span class="brand-name">FeedSystem</span>
      </router-link>

      <nav class="nav-links" aria-label="主导航">
        <router-link to="/" class="nav-link">时间线</router-link>
        <router-link v-if="auth.isLoggedIn" to="/publish" class="nav-link">发布视频</router-link>
        <router-link v-if="auth.isLoggedIn" to="/me" class="nav-link">我的视频</router-link>
      </nav>

      <div class="nav-user">
        <template v-if="auth.isLoggedIn">
          <span class="user-name">{{ auth.account?.username }}</span>
          <button class="btn btn-ghost btn-sm" @click="onLogout">退出</button>
        </template>
        <template v-else>
          <router-link to="/login" class="btn btn-ghost btn-sm">登录</router-link>
          <router-link to="/register" class="btn btn-primary btn-sm">注册</router-link>
        </template>
      </div>
    </div>
  </header>
</template>

<style scoped>
.nav {
  position: sticky;
  top: 0;
  z-index: var(--z-fixed);
  height: var(--nav-h);
  background: color-mix(in oklch, var(--bg) 86%, transparent);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid var(--border);
}

.nav-inner {
  height: 100%;
  display: flex;
  align-items: center;
  gap: var(--sp-6);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  font-weight: 700;
  font-size: var(--font-size-lg);
  letter-spacing: -0.01em;
}

.brand-dot {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  background: var(--accent);
}

.nav-links {
  display: flex;
  gap: var(--sp-2);
  margin-right: auto;
}

.nav-link {
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius-md);
  color: var(--text-2);
  font-size: var(--font-size-sm);
  font-weight: 600;
  transition: var(--trans-colors);
}

.nav-link:hover {
  color: var(--text);
  background: var(--surface-2);
}

.nav-link.router-link-active {
  color: var(--text);
}

.nav-user {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
}

.user-name {
  font-size: var(--font-size-sm);
  color: var(--text-2);
}

@media (max-width: 640px) {
  .nav-inner {
    gap: var(--sp-3);
  }
  .nav-link {
    padding: var(--sp-2);
  }
  .brand-name {
    display: none;
  }
  .user-name {
    display: none;
  }
}
</style>
