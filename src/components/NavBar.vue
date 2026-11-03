<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import NotificationBell from './NotificationBell.vue'

defineProps<{ peek?: boolean }>()

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const revealed = ref(false)
function onPeekEnter() {
  revealed.value = true
}
function onPeekLeave() {
  revealed.value = false
}

// feed 页：在导航栏内切换 推荐/关注（通过路由 query 驱动 FeedView）
const isFeed = computed(() => route.name === 'feed')
const feedTab = computed(() =>
  auth.isLoggedIn && route.query.tab === 'following' ? 'following' : 'recommend',
)

function switchFeedTab(tab: 'recommend' | 'following') {
  if (tab === 'following' && !auth.isLoggedIn) {
    router.push({ name: 'login', query: { redirect: '/' } })
    return
  }
  router.replace({ name: 'feed', query: tab === 'following' ? { tab: 'following' } : {} }).catch(() => {})
}

async function onLogout() {
  await auth.logout()
  router.push({ name: 'feed' })
}
</script>

<template>
  <div v-if="peek" class="peek-strip" aria-hidden="true" @mouseenter="onPeekEnter"></div>
  <header class="nav" :class="{ 'is-peek': peek, 'is-revealed': peek && revealed }" @mouseleave="onPeekLeave">
    <div class="container nav-inner">
      <router-link to="/" class="brand" aria-label="FeedSystem 首页">
        <span class="brand-dot" aria-hidden="true"></span>
        <span class="brand-name">FeedSystem</span>
      </router-link>

      <nav class="nav-links" aria-label="主导航">
        <div v-if="isFeed" class="feed-tabs" role="tablist" aria-label="Feed 切换">
          <button
            class="feed-tab"
            role="tab"
            :aria-selected="feedTab === 'recommend'"
            :class="{ 'is-active': feedTab === 'recommend' }"
            @click="switchFeedTab('recommend')"
          >
            推荐
          </button>
          <button
            class="feed-tab"
            role="tab"
            :aria-selected="feedTab === 'following'"
            :class="{ 'is-active': feedTab === 'following' }"
            @click="switchFeedTab('following')"
          >
            关注
          </button>
        </div>
        <router-link v-else to="/" class="nav-link">时间线</router-link>
        <router-link to="/popular" class="nav-link">热门视频</router-link>
        <router-link v-if="auth.isLoggedIn" to="/publish" class="nav-link">发布视频</router-link>
        <router-link v-if="auth.isLoggedIn" to="/me" class="nav-link">我的</router-link>
      </nav>

      <div class="nav-user">
        <template v-if="auth.isLoggedIn">
          <NotificationBell />
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

/* feed 页 hover 顶部滑出 */
.nav.is-peek {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  transform: translateY(-100%);
  pointer-events: none;
  transition: transform 200ms var(--ease-out);
}

.nav.is-peek.is-revealed {
  transform: translateY(0);
  pointer-events: auto;
}

.peek-strip {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 20px;
  z-index: calc(var(--z-fixed) + 1);
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
}

.brand-dot {
  width: 10px;
  height: 10px;
  background: var(--signal);
}

.nav-links {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-right: auto;
}

/* 推荐 / 关注 切换（Industrial 扁平分段控件，feed 页导航栏内） */
.feed-tabs {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  margin-right: var(--sp-2);
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid var(--border-strong);
}

.feed-tab {
  padding: 5px 14px;
  font-size: var(--font-size-sm);
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--text-3);
  transition: var(--trans-colors);
}

.feed-tab:hover {
  color: var(--text);
}

.feed-tab.is-active {
  color: var(--on-accent);
  background: var(--signal);
}

.nav-link {
  padding: var(--sp-2) var(--sp-3);
  color: var(--text-2);
  font-size: var(--font-size-sm);
  font-weight: 600;
  letter-spacing: 0.03em;
  transition: var(--trans-colors);
}

.nav-link:hover {
  color: var(--signal);
  background: var(--surface-2);
}

.nav-link.router-link-active {
  color: var(--signal);
  background: var(--signal-soft);
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
    gap: var(--sp-2);
  }
  .nav-links {
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .nav-links::-webkit-scrollbar {
    display: none;
  }
  .nav-link {
    padding: var(--sp-2) var(--sp-2);
    font-size: var(--font-size-xs);
    white-space: nowrap;
  }
  /* 移动端隐藏次要导航（发布/我的 走 feed 侧栏与我的页头），避免溢出 */
  .nav-link[href='/publish'],
  .nav-link[href='/me'] {
    display: none;
  }
  .brand-name {
    display: none;
  }
  .user-name {
    display: none;
  }
  .nav-user {
    gap: var(--sp-2);
  }
  .nav-user .btn-sm {
    height: 32px;
    padding-inline: var(--sp-3);
  }
  /* feed 页 hover 触发条：加高便于触控 */
  .peek-strip {
    height: 28px;
  }
}
</style>
