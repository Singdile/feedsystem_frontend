<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listVideos } from '../api/video'
import type { UserProfile, VideoView } from '../api/types'
import { follow, isFollowed, unfollow } from '../api/social'
import { getProfile, getUser } from '../api/user'
import { useAuthStore } from '../stores/auth'
import VideoCard from '../components/VideoCard.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const authorId = computed(() => Number(route.params.id))
const profile = ref<UserProfile | null>(null)
const loadingProfile = ref(true)
const notFound = ref(false)
const username = ref('')
const bio = computed(() => profile.value?.profile.bio || '')
const followed = ref<boolean | null>(null) // null = 未加载（匿名）
const acting = ref(false)

const items = ref<VideoView[]>([])
const nextCursor = ref('')
const loading = ref(false)
const error = ref('')
const done = ref(false)
const sentinel = ref<HTMLElement | null>(null)

const isSelf = computed(() => !!auth.account && auth.account.id === authorId.value)

const videoCount = computed(() =>
  profile.value ? profile.value.video_count : items.value.length,
)

// 公开 profile：用户名/简介/粉丝/关注/作品数（无需登录）
async function loadProfile() {
  loadingProfile.value = true
  notFound.value = false
  try {
    profile.value = await getProfile(authorId.value)
    username.value = profile.value.profile.username
  } catch (e) {
    profile.value = null
    notFound.value = (e as Error).message === '用户不存在'
    // 降级：query name（来自 feed 跳转）→ users/:id
    const fromQuery = typeof route.query.name === 'string' ? route.query.name : ''
    if (fromQuery) username.value = fromQuery
    else {
      try {
        const u = await getUser(authorId.value)
        username.value = u.username
      } catch {
        username.value = `用户${authorId.value}`
      }
    }
  } finally {
    loadingProfile.value = false
  }
}

async function loadFollow() {
  followed.value = null
  if (!auth.isLoggedIn || isSelf.value) return
  try {
    followed.value = await isFollowed(authorId.value)
  } catch {
    followed.value = null
  }
}

async function onFollow() {
  if (!auth.isLoggedIn) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  if (acting.value) return
  acting.value = true
  try {
    if (followed.value) {
      await unfollow(authorId.value)
      followed.value = false
    } else {
      await follow(authorId.value)
      followed.value = true
    }
  } catch (e) {
    showToast((e as Error).message || '操作失败')
  } finally {
    acting.value = false
  }
}

const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string) {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2200)
}

async function loadMore() {
  if (loading.value || done.value || notFound.value) return
  loading.value = true
  error.value = ''
  try {
    const res = await listVideos({ author_id: authorId.value, cursor: nextCursor.value, limit: 12 })
    items.value.push(...res.items)
    nextCursor.value = res.next_cursor
    if (!res.next_cursor || res.items.length === 0) done.value = true
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

let observer: IntersectionObserver | null = null

function setupObserver() {
  observer?.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((en) => en.isIntersecting)) loadMore()
    },
    { rootMargin: '600px 0px' },
  )
  if (sentinel.value) observer.observe(sentinel.value)
}

function avatarChar() {
  return (username.value || '?').charAt(0).toUpperCase()
}

// 切换作者（从 feed 头像连续点击不同作者）
watch(authorId, async () => {
  items.value = []
  nextCursor.value = ''
  done.value = false
  await loadProfile()
  await loadFollow()
  await loadMore()
  setupObserver()
})

onMounted(async () => {
  await loadProfile()
  await loadFollow()
  await loadMore()
  setupObserver()
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <div class="page container">
    <div v-if="notFound" class="state">
      <p class="state-title">用户不存在</p>
      <p class="state-hint">这位创作者可能已被注销。</p>
      <router-link to="/" class="btn btn-ghost">返回时间线</router-link>
    </div>

    <template v-else>
      <div class="author-head">
        <span class="author-avatar" aria-hidden="true">{{ avatarChar() }}</span>
        <div class="author-id">
          <h1 class="author-name">
            <span class="meta-at">@</span>{{ loadingProfile ? '…' : username }}
          </h1>
          <p v-if="bio" class="author-bio">{{ bio }}</p>
          <p class="author-sub">
            作品 <strong>{{ videoCount }}</strong>
            <span aria-hidden="true">·</span>
            粉丝 <strong>{{ profile ? profile.follower_count : '—' }}</strong>
            <span aria-hidden="true">·</span>
            关注 <strong>{{ profile ? profile.vlogger_count : '—' }}</strong>
          </p>
        </div>
        <button
          v-if="!isSelf"
          class="btn follow-btn"
          :class="followed ? 'btn-ghost' : 'btn-primary'"
          :disabled="acting"
          @click="onFollow"
        >
          <template v-if="followed === null">关注</template>
          <template v-else-if="acting">…</template>
          <template v-else-if="followed">已关注</template>
          <template v-else>+ 关注</template>
        </button>
      </div>

      <div v-if="error" class="alert alert-error" role="alert">{{ error }}</div>

      <div v-if="!loading && done && items.length === 0" class="state">
        <p class="state-title">还没有发布视频</p>
        <p class="state-hint">这位创作者的第一条视频会出现在这里。</p>
        <router-link v-if="isSelf" to="/publish" class="btn btn-primary">去发布</router-link>
      </div>

      <div v-else class="grid">
        <VideoCard v-for="v in items" :key="v.id" :video="v" />
      </div>

      <div ref="sentinel" class="loading-inline" aria-live="polite">
        <span v-if="loading" class="spinner" aria-hidden="true"></span>
        <template v-if="loading">加载中…</template>
        <template v-else-if="done && items.length > 0">已经到底了</template>
      </div>
    </template>

    <Transition name="toast">
      <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.author-head {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  padding: var(--sp-5) 0 var(--sp-6);
}

.author-avatar {
  width: 72px;
  height: 72px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xl);
  font-weight: 800;
  color: var(--signal);
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
}

.author-id {
  flex: 1;
  min-width: 0;
}

.author-name {
  margin: 0;
  font-size: var(--font-size-xl);
  line-height: var(--line-tight);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-at {
  color: var(--cyan);
}

.author-sub {
  margin: var(--sp-1) 0 0;
  color: var(--text-3);
  font-size: var(--font-size-sm);
  display: flex;
  gap: 6px;
  align-items: center;
}

.author-sub strong {
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.author-bio {
  margin: var(--sp-2) 0 0;
  color: var(--text-2);
  font-size: var(--font-size-sm);
  line-height: var(--line-normal);
}

.follow-btn {
  min-width: 108px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--sp-5);
}

.toast {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-modal);
  padding: 9px 18px;
  border-radius: var(--radius-full);
  background: var(--grad-brand);
  color: #fff;
  font-size: var(--font-size-sm);
  font-weight: 600;
  box-shadow: var(--shadow-md);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-spring);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px);
}
</style>
