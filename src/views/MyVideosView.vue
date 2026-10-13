<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { deleteVideo, listVideos } from '../api/video'
import { listLikedVideos } from '../api/rating'
import { listFollowers, listFollowing, getSocialCounts, unfollow } from '../api/social'
import type { VideoView } from '../api/types'
import { useAuthStore } from '../stores/auth'
import VideoCard from '../components/VideoCard.vue'

const auth = useAuthStore()

const tabs = [
  { key: 'videos', label: '作品' },
  { key: 'liked', label: '赞过的' },
  { key: 'following', label: '关注' },
  { key: 'followers', label: '粉丝' },
] as const
type TabKey = (typeof tabs)[number]['key']
const tab = ref<TabKey>('videos')

// ---- 个人计数（/social/counts）----
const counts = ref<{ followers: number; following: number } | null>(null)

async function loadCounts() {
  try {
    counts.value = await getSocialCounts()
  } catch {
    // 计数接口异常静默降级
  }
}

// ---- 作品 ----
const items = ref<VideoView[]>([])
const nextCursor = ref('')
const loading = ref(false)
const error = ref('')
const done = ref(false)
const deletingId = ref<number | null>(null)

async function loadMore() {
  if (loading.value || done.value || tab.value !== 'videos') return
  loading.value = true
  error.value = ''
  try {
    const res = await listVideos({ author_id: auth.account?.id, cursor: nextCursor.value, limit: 12 })
    items.value.push(...res.items)
    nextCursor.value = res.next_cursor
    if (!res.next_cursor || res.items.length === 0) done.value = true
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

async function onDelete(v: VideoView) {
  if (!window.confirm(`确定删除《${v.title}》吗？删除后无法恢复。`)) return
  deletingId.value = v.id
  try {
    await deleteVideo(v.id)
    items.value = items.value.filter((x) => x.id !== v.id)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    deletingId.value = null
  }
}

// ---- 赞过的 ----
const liked = ref<VideoView[]>([])
const likedCursor = ref('')
const likedLoading = ref(false)
const likedDone = ref(false)
const likedLoaded = ref(false)

async function loadLiked() {
  if (likedLoading.value || likedDone.value) return
  likedLoading.value = true
  try {
    const res = await listLikedVideos(likedCursor.value, 12)
    liked.value.push(...res.videos)
    likedCursor.value = res.next_cursor
    if (!res.next_cursor || res.videos.length === 0) likedDone.value = true
    likedLoaded.value = true
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    likedLoading.value = false
  }
}

// ---- 关注 / 粉丝（后端直接返回 {id, username}，空列表归一化为 []）----
type Person = import('../api/social').SocialUser
const following = ref<Person[]>([])
const followers = ref<Person[]>([])
const socialLoading = ref<Record<'following' | 'followers', boolean>>({ following: false, followers: false })
const socialLoaded = ref<Record<string, boolean>>({})
const unfollowingId = ref<number | null>(null)

async function loadSocial(key: 'following' | 'followers') {
  if (socialLoading.value[key] || socialLoaded.value[key]) return
  socialLoading.value = { ...socialLoading.value, [key]: true }
  try {
    const list = key === 'following' ? await listFollowing() : await listFollowers()
    if (key === 'following') following.value = list
    else followers.value = list
    socialLoaded.value = { ...socialLoaded.value, [key]: true }
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    socialLoading.value = { ...socialLoading.value, [key]: false }
  }
}

async function onUnfollow(p: Person) {
  unfollowingId.value = p.id
  try {
    await unfollow(p.id)
    following.value = following.value.filter((x) => x.id !== p.id)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    unfollowingId.value = null
  }
}

function avatarChar(name: string) {
  return (name || '?').charAt(0).toUpperCase()
}

// ---- 滚动加载（作品/赞过的共用 sentinel）----
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

function setupObserver() {
  observer?.disconnect()
  observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((en) => en.isIntersecting)) return
      if (tab.value === 'videos') loadMore()
      else if (tab.value === 'liked') loadLiked()
    },
    { rootMargin: '600px 0px' },
  )
  if (sentinel.value) observer.observe(sentinel.value)
}

async function onTab(k: TabKey) {
  tab.value = k
  if (k === 'liked' && !likedLoaded.value) loadLiked()
  if (k === 'following' || k === 'followers') loadSocial(k)
  await nextTick()
  setupObserver()
}

onMounted(() => {
  loadMore()
  // 预载其余 tab，进入页面即可显示真实数字
  loadLiked()
  loadSocial('following')
  loadSocial('followers')
  loadCounts()
  setupObserver()
})

onUnmounted(() => observer?.disconnect())

watch(tab, async () => {
  await nextTick()
  setupObserver()
})
</script>

<template>
  <div class="page container">
    <div class="section-head">
      <h2>我的</h2>
      <router-link to="/publish" class="btn btn-primary btn-sm">发布新视频</router-link>
    </div>

    <div class="profile-bar">
      <span class="profile-avatar" aria-hidden="true">{{ avatarChar(auth.account?.username || '?') }}</span>
      <div class="profile-id">
        <span class="profile-name">@{{ auth.account?.username }}</span>
        <p class="profile-stats">
          粉丝
          <strong>{{ counts ? counts.followers : '—' }}</strong>
          <span aria-hidden="true">·</span>
          关注
          <strong>{{ counts ? counts.following : '—' }}</strong>
        </p>
      </div>
    </div>

    <nav class="tabs" aria-label="我的内容">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ 'is-active': tab === t.key }"
        @click="onTab(t.key)"
      >
        {{ t.label }}
        <span v-if="t.key === 'videos'" class="tab-num">{{ items.length }}</span>
        <span v-else-if="t.key === 'liked'" class="tab-num">{{ liked.length }}</span>
        <span v-else-if="t.key === 'following'" class="tab-num">{{ following.length }}</span>
        <span v-else class="tab-num">{{ followers.length }}</span>
      </button>
    </nav>

    <div v-if="error" class="alert alert-error" role="alert">{{ error }}</div>

    <!-- 作品 -->
    <template v-if="tab === 'videos'">
      <div v-if="!loading && done && items.length === 0" class="state">
        <p class="state-title">你还没有发布过视频</p>
        <p class="state-hint">发布第一条视频，它会出现在所有人的时间线里。</p>
        <router-link to="/publish" class="btn btn-primary">去发布</router-link>
      </div>
      <div v-else class="grid">
        <div v-for="v in items" :key="v.id" class="cell">
          <VideoCard :video="v" />
          <button
            class="btn btn-danger btn-sm delete-btn"
            :disabled="deletingId === v.id"
            @click="onDelete(v)"
          >
            {{ deletingId === v.id ? '删除中…' : '删除' }}
          </button>
        </div>
      </div>
    </template>

    <!-- 赞过的 -->
    <template v-else-if="tab === 'liked'">
      <div v-if="!likedLoading && likedDone && liked.length === 0" class="state">
        <p class="state-title">还没有赞过视频</p>
        <p class="state-hint">在时间线点亮心形，这里会收藏起来。</p>
        <router-link to="/" class="btn btn-ghost">去刷视频</router-link>
      </div>
      <div v-else class="grid">
        <VideoCard v-for="v in liked" :key="v.id" :video="v" />
      </div>
    </template>

    <!-- 关注 -->
    <template v-else-if="tab === 'following'">
      <div v-if="!socialLoading.following && socialLoaded.following && following.length === 0" class="state">
        <p class="state-title">还没有关注任何人</p>
        <p class="state-hint">在时间线点头像旁的 +，关注喜欢的创作者。</p>
        <router-link to="/" class="btn btn-ghost">去发现</router-link>
      </div>
      <ul v-else class="people">
        <li v-for="p in following" :key="p.id" class="person">
          <router-link :to="{ name: 'author', params: { id: p.id }, query: { name: p.username } }" class="person-id">
            <span class="person-avatar" aria-hidden="true">{{ avatarChar(p.username) }}</span>
            <span class="person-name">@{{ p.username }}</span>
          </router-link>
          <button
            class="btn btn-ghost btn-sm"
            :disabled="unfollowingId === p.id"
            @click="onUnfollow(p)"
          >
            {{ unfollowingId === p.id ? '…' : '已关注' }}
          </button>
        </li>
      </ul>
    </template>

    <!-- 粉丝 -->
    <template v-else>
      <div v-if="!socialLoading.followers && socialLoaded.followers && followers.length === 0" class="state">
        <p class="state-title">还没有粉丝</p>
        <p class="state-hint">发布更多视频，让更多人看到你。</p>
        <router-link to="/publish" class="btn btn-primary">去发布</router-link>
      </div>
      <ul v-else class="people">
        <li v-for="p in followers" :key="p.id" class="person">
          <router-link :to="{ name: 'author', params: { id: p.id }, query: { name: p.username } }" class="person-id">
            <span class="person-avatar" aria-hidden="true">{{ avatarChar(p.username) }}</span>
            <span class="person-name">@{{ p.username }}</span>
          </router-link>
          <router-link :to="{ name: 'author', params: { id: p.id }, query: { name: p.username } }" class="btn btn-ghost btn-sm">
            看主页
          </router-link>
        </li>
      </ul>
    </template>

    <div
      v-if="tab === 'videos' || tab === 'liked'"
      ref="sentinel"
      class="loading-inline"
      aria-live="polite"
    >
      <span v-if="loading || likedLoading" class="spinner" aria-hidden="true"></span>
      <template v-if="loading || likedLoading">加载中…</template>
      <template v-else-if="tab === 'videos' && done && items.length > 0">已经到底了</template>
      <template v-else-if="tab === 'liked' && likedDone && liked.length > 0">已经到底了</template>
    </div>
  </div>
</template>

<style scoped>
.profile-bar {
  display: flex;
  align-items: center;
  gap: var(--sp-4);
  margin-bottom: var(--sp-5);
  padding: var(--sp-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.profile-avatar {
  width: 56px;
  height: 56px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-lg);
  font-weight: 800;
  color: var(--signal);
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
}

.profile-id {
  min-width: 0;
}

.profile-name {
  font-weight: 800;
  font-size: var(--font-size-lg);
}

.profile-stats {
  margin: var(--sp-1) 0 0;
  color: var(--text-3);
  font-size: var(--font-size-sm);
  display: flex;
  gap: 6px;
  align-items: center;
}

.profile-stats strong {
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

.tabs {
  display: flex;
  gap: var(--sp-2);
  margin-bottom: var(--sp-5);
  border-bottom: 1px solid var(--border);
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  font-size: var(--font-size-base);
  font-weight: 700;
  color: var(--text-3);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: var(--trans-colors);
}

.tab:hover {
  color: var(--text);
}

.tab.is-active {
  color: var(--text);
  border-bottom-color: var(--magenta);
}

.tab-num {
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
  padding: 1px 7px;
  border-radius: var(--radius-full);
  background: var(--surface-2);
  color: var(--text-2);
}

.tab.is-active .tab-num {
  background: var(--magenta);
  color: #fff;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--sp-5);
}

.cell {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.delete-btn {
  align-self: flex-start;
}

/* 关注/粉丝列表 */
.people {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
}

.person {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.person-id {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-3);
  min-width: 0;
  color: inherit;
}

.person-avatar {
  width: 40px;
  height: 40px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  color: var(--signal);
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
}

.person-name {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
