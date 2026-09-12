<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { listFeed } from '../api/feed'
import type { VideoView } from '../api/types'
import { useAuthStore } from '../stores/auth'
import { formatDate } from '../utils/format'
import ImmersiveVideo from '../components/ImmersiveVideo.vue'

const auth = useAuthStore()

const container = ref<HTMLElement | null>(null)
const items = ref<VideoView[]>([])
const nextCursor = ref('')
const loading = ref(false)
const error = ref('')
const done = ref(false)

const activeIdx = ref(0)
const pausedMap = ref<Record<number, boolean>>({})

const itemEls = new Map<number, HTMLElement>()
const comps = new Map<number, InstanceType<typeof ImmersiveVideo>>()

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

function playAt(i: number) {
  comps.forEach((c, idx) => (idx === i ? c.play() : c.pause()))
  activeIdx.value = i
}

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
    // 新条目进入 active 观察
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
  }
})

onUnmounted(() => {
  activeObserver?.disconnect()
  loadObserver?.disconnect()
  comps.forEach((c) => c.pause())
  comps.clear()
  itemEls.clear()
})
</script>

<template>
  <div ref="container" class="feed-page">
    <router-link to="/" class="brand-corner" aria-label="FeedSystem 首页">
      <span class="brand-dot" aria-hidden="true"></span>
      <span>FeedSystem</span>
    </router-link>

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
        :src="v.play_url"
        :poster="v.cover_url"
        mode="cover"
        :show-info="true"
        :show-fullscreen="false"
        :muted="true"
        :preload="i === activeIdx ? 'auto' : 'metadata'"
        :info="{
          title: v.title,
          author: v.author.username,
          description: v.description,
          time: formatDate(v.created_at),
        }"
        :ref="(c: any) => trackComp(i, c)"
        @state="(s: any) => onState(i, s)"
      />

      <div class="rail" aria-label="操作">
        <template v-if="auth.isLoggedIn">
          <router-link to="/publish" class="rail-btn">发布</router-link>
          <router-link to="/me" class="rail-btn">我的</router-link>
        </template>
        <template v-else>
          <router-link to="/login" class="rail-btn">登录</router-link>
          <router-link to="/register" class="rail-btn">注册</router-link>
        </template>
      </div>
    </section>

    <div ref="loadSentinel" class="sentinel" aria-hidden="true"></div>

    <div v-if="loading" class="loading-float" aria-live="polite">
      <span class="spinner" aria-hidden="true"></span>
      加载中…
    </div>
    <div v-else-if="done && items.length > 0" class="loading-float">已经到底了</div>
  </div>
</template>

<style scoped>
.feed-page {
  position: fixed;
  inset: 0;
  overflow-y: auto;
  scroll-snap-type: y mandatory;
  overscroll-behavior: contain;
  background: #000;
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

.brand-corner {
  position: fixed;
  top: 16px;
  left: 16px;
  z-index: 6;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-weight: 700;
  font-size: var(--font-size-lg);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}

.brand-dot {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  background: var(--accent);
}

.rail {
  position: absolute;
  right: 12px;
  bottom: 140px;
  z-index: 6;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.rail-btn {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(8px);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  transition: var(--trans-colors), var(--trans-transform);
}

.rail-btn:hover {
  background: rgba(255, 255, 255, 0.26);
  transform: scale(1.05);
}

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
  top: 72px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-4);
  border-radius: var(--radius-full);
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  color: rgba(255, 255, 255, 0.9);
  font-size: var(--font-size-sm);
  pointer-events: none;
}

@media (max-width: 640px) {
  .rail {
    right: 10px;
    bottom: 120px;
  }
  .rail-btn {
    width: 48px;
    height: 48px;
  }
}
</style>
