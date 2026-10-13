<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { listFeed } from '../api/feed'
import type { VideoView } from '../api/types'
import { setRating } from '../api/rating'
import { follow, isFollowed, unfollow } from '../api/social'
import { useAuthStore } from '../stores/auth'
import { formatDate } from '../utils/format'
import { proxiedUrl } from '../api/minio'
import ImmersiveVideo from '../components/ImmersiveVideo.vue'
import CommentDrawer from '../components/CommentDrawer.vue'

const auth = useAuthStore()
const router = useRouter()

const container = ref<HTMLElement | null>(null)
const items = ref<VideoView[]>([])
const nextCursor = ref('')
const loading = ref(false)
const error = ref('')
const done = ref(false)

const activeIdx = ref(0)
const pausedMap = ref<Record<number, boolean>>({})
const progressMap = ref<Record<number, number>>({})

// ---- 评论（计数直接用 feed item 的 comment_count）----
const commentOpen = ref(false)
const commentVideo = ref<VideoView | null>(null)

function openComments(v: VideoView) {
  commentVideo.value = v
  commentOpen.value = true
  comps.get(activeIdx.value)?.pause()
}

function closeComments() {
  commentOpen.value = false
  commentVideo.value = null
  playAt(activeIdx.value)
}

function patchItem(id: number, patch: Partial<VideoView>) {
  const i = items.value.findIndex((x) => x.id === id)
  if (i >= 0) items.value[i] = { ...items.value[i], ...patch }
}

function onCommentCount(videoId: number | undefined, n: number) {
  if (videoId === undefined) return
  patchItem(videoId, { comment_count: n })
}

const itemEls = new Map<number, HTMLElement>()
const comps = new Map<number, InstanceType<typeof ImmersiveVideo>>()

const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string) {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2200)
}

const isPlaying = computed(() => !pausedMap.value[activeIdx.value])

function trackItem(i: number, el: HTMLElement | null) {
  if (el) itemEls.set(i, el)
  else itemEls.delete(i)
}

function trackComp(i: number, c: InstanceType<typeof ImmersiveVideo> | null) {
  if (c) comps.set(i, c)
  else comps.delete(i)
}

function onState(i: number, s: { paused: boolean }) {
  pausedMap.value = { ...pausedMap.value, [i]: s.paused }
}

function onProgress(i: number, p: { current: number; duration: number }) {
  progressMap.value = {
    ...progressMap.value,
    [i]: p.duration ? (p.current / p.duration) * 100 : 0,
  }
}

function playAt(i: number) {
  comps.forEach((c, idx) => (idx === i ? c.play() : c.pause()))
  activeIdx.value = i
}

// ---- 点赞（rating）：状态与计数直接来自 feed item 的 status / liked_count ----
async function toggleLike(v: VideoView) {
  if (!auth.isLoggedIn) {
    showToast('请先登录后再点赞')
    return
  }
  const nextAction: 'like' | 'none' = v.status === 1 ? 'none' : 'like'
  try {
    const stat = await setRating(v.id, nextAction)
    let liked = v.liked_count
    if (stat === 1 && v.status !== 1) liked += 1
    else if (stat !== 1 && v.status === 1) liked = Math.max(0, liked - 1)
    patchItem(v.id, { status: stat, liked_count: liked })
  } catch (e) {
    showToast((e as Error).message || '点赞失败')
  }
}

// ---- 关注（social）：按作者 id 记录关注态 ----
const followState = ref<Record<number, boolean>>({})

async function loadActiveFollow() {
  const v = items.value[activeIdx.value]
  if (!v || !auth.isLoggedIn) return
  if (followState.value[v.author.id] !== undefined) return
  try {
    const followed = await isFollowed(v.author.id)
    followState.value = { ...followState.value, [v.author.id]: followed }
  } catch {
    // 关注接口异常时静默降级（徽标不展示）
  }
}

async function toggleFollow(v: VideoView) {
  if (!auth.isLoggedIn) {
    showToast('请先登录后再关注')
    return
  }
  const id = v.author.id
  const now = followState.value[id] ?? false
  try {
    if (now) {
      await unfollow(id)
      followState.value = { ...followState.value, [id]: false }
      showToast('已取消关注')
    } else {
      await follow(id)
      followState.value = { ...followState.value, [id]: true }
      showToast(`已关注 @${v.author.username}`)
    }
  } catch (e) {
    showToast((e as Error).message || '操作失败')
  }
}

function goAuthor(v: VideoView) {
  router.push({ name: 'author', params: { id: v.author.id }, query: { name: v.author.username } })
}

// 登录态变化时刷新 feed（status 盖章与关注态依赖登录）
watch(
  () => auth.isLoggedIn,
  async () => {
    followState.value = {}
    items.value = []
    nextCursor.value = ''
    done.value = false
    activeIdx.value = 0
    await loadMore()
    if (items.value.length) {
      await nextTick()
      playAt(0)
      loadActiveFollow()
    }
  },
)

watch(activeIdx, () => {
  loadActiveFollow()
})

async function loadMore() {
  if (loading.value || done.value) return
  loading.value = true
  error.value = ''
  try {
    const res = await listFeed(nextCursor.value, 10)
    items.value.push(...res.items)
    nextCursor.value = res.next_cursor
    if (!res.next_cursor || res.items.length === 0) done.value = true
    await nextTick()
    itemEls.forEach((el) => activeObserver?.observe(el))
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

let activeObserver: IntersectionObserver | null = null

function observeActive() {
  if (!container.value || !items.value.length) return
  activeObserver = new IntersectionObserver(
    (entries) => {
      if (commentOpen.value) return
      for (const en of entries) {
        if (en.isIntersecting) {
          for (const [i, el] of itemEls) {
            if (el === en.target && i !== activeIdx.value) {
              playAt(i)
              break
            }
          }
        }
      }
    },
    { root: container.value, threshold: 0.6 },
  )
  itemEls.forEach((el) => activeObserver?.observe(el))
}

let loadObserver: IntersectionObserver | null = null

function observeLoad() {
  if (!container.value || !loadSentinel.value) return
  loadObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((en) => en.isIntersecting)) loadMore()
    },
    { root: container.value, rootMargin: '0px 0px 20% 0px' },
  )
  loadObserver.observe(loadSentinel.value)
}

const loadSentinel = ref<HTMLElement | null>(null)

onMounted(async () => {
  await loadMore()
  if (items.value.length) {
    await nextTick()
    observeActive()
    observeLoad()
    playAt(0)
    loadActiveFollow()
  }
})

onUnmounted(() => {
  activeObserver?.disconnect()
  loadObserver?.disconnect()
  comps.forEach((c) => c.pause())
  comps.clear()
  itemEls.clear()
})

// #话题 高亮：把文本切成普通段 + 标签段
interface Seg {
  text: string
  isTag: boolean
}
function tagify(text?: string): Seg[] {
  if (!text) return []
  const parts: Seg[] = []
  const re = /(#[A-Za-z0-9_\u4e00-\u9fa5]+)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), isTag: false })
    parts.push({ text: m[1], isTag: true })
    last = m.index + m[1].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), isTag: false })
  return parts
}

function avatarChar(username: string) {
  return (username || '?').charAt(0).toUpperCase()
}

async function shareLink(id: number) {
  try {
    await navigator.clipboard.writeText(`${location.origin}/videos/${id}`)
    showToast('视频链接已复制')
  } catch {
    showToast('复制失败，请手动复制链接')
  }
}
</script>

<template>
  <div ref="container" class="feed-page" :class="{ 'is-locked': commentOpen }">
    <!-- 顶部品牌角标 -->
    <div class="top-bar">
      <router-link to="/" class="brand-corner" aria-label="FeedSystem 首页">
        <span class="brand-dot" aria-hidden="true"></span>
        <span class="brand-name">FeedSystem</span>
      </router-link>
      <span class="index-chip" aria-hidden="true">{{ activeIdx + 1 }} / {{ items.length }}</span>
    </div>

    <div v-if="error && items.length === 0" class="full-state">
      <p class="state-title">加载失败</p>
      <p class="state-hint">{{ error }}</p>
      <button class="btn btn-ghost" @click="loadMore">重试</button>
    </div>
    <div v-else-if="items.length === 0 && done && !loading" class="full-state">
      <p class="state-title">时间线还是空的</p>
      <p class="state-hint">去发布你的第一条视频吧。</p>
      <router-link to="/publish" class="btn btn-primary">发布视频</router-link>
    </div>

    <section
      v-for="(v, i) in items"
      :key="v.id"
      class="feed-item"
      :ref="(el: any) => trackItem(i, el)"
    >
      <ImmersiveVideo
        class="feed-video"
        :src="proxiedUrl(v.play_url)"
        :poster="v.cover_url ? proxiedUrl(v.cover_url) : undefined"
        mode="cover"
        :show-info="false"
        :show-fullscreen="false"
        :muted="true"
        :preload="i === activeIdx ? 'auto' : 'metadata'"
        :ref="(c: any) => trackComp(i, c)"
        @state="(s: any) => onState(i, s)"
        @progress="(p: any) => onProgress(i, p)"
      />

      <!-- 当前视频顶部霓虹进度线 -->
      <div
        v-if="i === activeIdx"
        class="top-progress"
        aria-hidden="true"
        :style="{ width: `${progressMap[i] ?? 0}%` }"
      ></div>

      <!-- 左下：作者 + 超大展示标题 + 描述/话题 -->
      <div class="meta-block" :class="{ 'is-paused': pausedMap[i] }">
        <p class="meta-author">
          <span class="meta-at" aria-hidden="true">@</span>{{ v.author.username }}
          <span class="meta-time">{{ formatDate(v.created_at) }}</span>
        </p>
        <h1 class="meta-title">{{ v.title }}</h1>
        <p v-if="v.description" class="meta-desc">
          <template v-for="(seg, si) in tagify(v.description)" :key="si">
            <span v-if="seg.isTag" class="tag neon">{{ seg.text }}</span>
            <template v-else>{{ seg.text }}</template>
          </template>
        </p>
      </div>

      <!-- 右侧霓虹操作栏 -->
      <div class="rail" aria-label="操作">
        <div class="avatar-wrap">
          <button class="rail-btn avatar-ring" aria-label="作者主页" @click="goAuthor(v)">
            <span class="avatar">{{ avatarChar(v.author.username) }}</span>
          </button>
          <button
            v-if="followState[v.author.id] !== undefined && v.author.id !== auth.account?.id"
            class="follow-badge"
            :class="{ 'is-on': followState[v.author.id] }"
            :aria-label="followState[v.author.id] ? '取消关注' : '关注作者'"
            @click="toggleFollow(v)"
          >
            {{ followState[v.author.id] ? '✓' : '+' }}
          </button>
        </div>

        <button
          class="rail-btn"
          :class="{ 'is-liked': v.status === 1 }"
          aria-label="点赞"
          @click="toggleLike(v)"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M12 21s-7.5-4.7-10-9.2C.5 8.6 2.2 5.5 5.2 5.1c1.8-.2 3.6.6 4.8 2.1L12 9.4l2-2.2c1.2-1.5 3-2.3 4.8-2.1 3 .4 4.7 3.5 3.2 6.7C19.5 16.3 12 21 12 21z"
            />
          </svg>
          <span class="rail-label">{{ v.liked_count > 0 ? v.liked_count : '' }}</span>
        </button>

        <button class="rail-btn" aria-label="评论" @click="openComments(v)">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4.5 3.2A.8.8 0 0 1 3 18.5V6z"
            />
          </svg>
          <span class="rail-label">{{ v.comment_count > 0 ? v.comment_count : '' }}</span>
        </button>

        <button class="rail-btn" aria-label="分享" @click="shareLink(v.id)">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M18 8a3 3 0 1 0-.6-5.9 3 3 0 0 0 .6 5.9zM6 15a3 3 0 1 0-.6-5.9A3 3 0 0 0 6 15zM18 21a3 3 0 1 0-.6-5.9A3 3 0 0 0 18 21zM8.4 13.7l7.2 4.3m-7.2-7l7.2-4.3"
            />
          </svg>
          <span class="rail-label">分享</span>
        </button>

        <template v-if="auth.isLoggedIn">
          <router-link to="/publish" class="rail-btn rail-link" aria-label="发布">发布</router-link>
          <router-link to="/me" class="rail-btn rail-link" aria-label="我的">我的</router-link>
        </template>
        <template v-else>
          <router-link to="/login" class="rail-btn rail-link" aria-label="登录">登录</router-link>
        </template>
      </div>
    </section>

    <div ref="loadSentinel" class="sentinel" aria-hidden="true"></div>

    <div v-if="loading" class="loading-float" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      加载中…
    </div>
    <div v-else-if="done && items.length > 0" class="loading-float">已经到底了</div>

    <!-- 轻量提示 -->
    <Transition name="toast">
      <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    </Transition>

    <!-- 评论抽屉 -->
    <CommentDrawer
      :video="commentVideo"
      :toast="showToast"
      @close="closeComments"
      @count-change="onCommentCount(commentVideo?.id, $event)"
    />
  </div>
</template>

<style scoped>
.feed-page {
  position: fixed;
  inset: 0;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  overscroll-behavior: contain;
  background: var(--bg);
}

.feed-page.is-locked {
  overflow: hidden;
}

.feed-item {
  position: relative;
  height: 100dvh;
  scroll-snap-align: start;
  scroll-snap-stop: always;
  overflow: hidden;
  background: #000;
}

.feed-video {
  height: 100%;
}

/* ---- 顶部栏 ---- */
.top-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 7;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  pointer-events: none;
}

.brand-corner {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text);
  font-weight: 800;
  font-size: var(--font-size-lg);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}

.brand-dot {
  width: 10px;
  height: 10px;
  background: var(--signal);
}

.index-chip {
  pointer-events: auto;
  color: var(--text-2);
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.08em;
  padding: 5px 12px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  border: 1px solid var(--border-strong);
}

/* ---- 顶部进度线（信号色实线） ---- */
.top-progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 3px;
  z-index: 7;
  background: var(--signal);
  transition: width 180ms linear;
}

/* ---- 左下信息块（超大展示字重） ---- */
.meta-block {
  position: absolute;
  left: 14px;
  right: 92px;
  bottom: 96px;
  z-index: 5;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

.meta-author {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
  font-weight: 700;
  font-size: var(--font-size-base);
}

.meta-at {
  color: var(--signal);
}

.meta-time {
  font-size: var(--font-size-xs);
  color: rgba(255, 255, 255, 0.66);
  font-weight: 500;
  margin-left: 4px;
}

.meta-title {
  margin: 0 0 8px;
  font-size: var(--font-display);
  font-weight: 800;
  line-height: var(--line-tight);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.meta-desc {
  margin: 0;
  font-size: var(--font-size-base);
  color: rgba(255, 255, 255, 0.92);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tag {
  color: var(--signal);
  font-weight: 700;
}

/* ---- 右侧操作栏（扁平，1px 边框） ---- */
.rail {
  position: absolute;
  right: 12px;
  bottom: 140px;
  z-index: 6;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
}

.rail-btn {
  width: 56px;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: #fff;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border-strong);
  padding: 10px 0;
  transition: var(--trans-colors), var(--trans-transform);
}

.rail-btn:hover {
  transform: translateY(-2px);
  border-color: var(--signal);
  color: var(--signal);
}

.rail-btn:active {
  transform: scale(0.96);
}

.rail-btn.is-liked {
  border-color: var(--signal);
  background: var(--signal-soft);
}

.rail-btn.is-liked svg {
  color: var(--signal);
}

.rail-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
}

.avatar-wrap {
  position: relative;
  margin-bottom: 8px;
}

.avatar-ring {
  width: 56px;
  height: 56px;
  padding: 0;
  border: 1px solid var(--border-strong);
  background: var(--surface);
}

/* 关注徽标：头像下方信号色方块 */
.follow-badge {
  position: absolute;
  left: 50%;
  bottom: -12px;
  transform: translateX(-50%);
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 800;
  line-height: 1;
  color: var(--on-accent);
  background: var(--signal);
  border: 1px solid var(--bg);
  transition: var(--trans-colors), var(--trans-transform);
  z-index: 1;
}

.follow-badge:hover {
  transform: translateX(-50%) scale(1.1);
  background: var(--signal-hover);
}

.follow-badge:active {
  transform: translateX(-50%) scale(0.92);
}

.follow-badge.is-on {
  background: var(--surface-2);
  color: var(--signal);
  border-color: var(--signal);
}

.avatar {
  width: 54px;
  height: 54px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-lg);
  font-weight: 800;
  color: var(--signal);
  background: var(--surface-2);
}

.rail-link {
  font-size: var(--font-size-xs);
  font-weight: 700;
}

/* ---- 全屏状态 ---- */
.full-state {
  height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-3);
  color: var(--text-2);
  text-align: center;
  padding: var(--sp-6);
}

.sentinel {
  height: 1px;
}

.loading-float {
  position: fixed;
  top: 64px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-4);
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
  color: var(--text-2);
  font-size: var(--font-size-sm);
  border: 1px solid var(--border-strong);
  pointer-events: none;
}

/* ---- 轻提示 ---- */
.toast {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  z-index: var(--z-modal);
  padding: 9px 18px;
  background: var(--bg);
  color: var(--signal);
  font-size: var(--font-size-sm);
  font-weight: 600;
  border: 1px solid var(--signal);
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

@media (max-width: 640px) {
  .rail {
    right: 10px;
    bottom: 120px;
    gap: 12px;
  }
  .rail-btn {
    width: 50px;
  }
  .meta-block {
    left: 12px;
    right: 74px;
    bottom: 88px;
  }
  .brand-name {
    display: none;
  }
}
</style>
