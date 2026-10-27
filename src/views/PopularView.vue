<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { listPopular } from '../api/feed'
import type { VideoView } from '../api/types'
import VideoCard from '../components/VideoCard.vue'

const items = ref<VideoView[]>([])
const asOf = ref(0)
const offset = ref(0)
const hasMore = ref(true)
const loading = ref(false)
const error = ref('')
const empty = ref(false)
const sentinel = ref<HTMLElement | null>(null)

async function loadMore() {
  if (loading.value || !hasMore.value) return
  loading.value = true
  error.value = ''
  try {
    const res = await listPopular({ asof: asOf.value, offset: offset.value, limit: 12 })
    items.value.push(...res.items)
    asOf.value = res.as_of
    offset.value = res.offset
    hasMore.value = res.has_more
  } catch (e) {
    // 后端空热榜会 500「视频数据获取失败」→ 前端视作空态
    hasMore.value = false
    if (items.value.length === 0) empty.value = true
    else error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

async function refresh() {
  items.value = []
  asOf.value = 0
  offset.value = 0
  hasMore.value = true
  empty.value = false
  await loadMore()
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

onMounted(() => {
  loadMore()
  setupObserver()
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <div class="page container">
    <div class="section-head">
      <h2>热门</h2>
      <button class="btn btn-ghost btn-sm" :disabled="loading" @click="refresh">刷新</button>
    </div>

    <div v-if="error" class="alert alert-error" role="alert">{{ error }}</div>

    <div v-if="empty && !loading" class="state">
      <p class="state-title">热度榜单还是空的</p>
      <p class="state-hint">给视频点赞、评论会产生热度，稍后回来看看吧。</p>
      <router-link to="/" class="btn btn-ghost">去刷视频</router-link>
    </div>

    <div v-else class="grid">
      <VideoCard v-for="v in items" :key="v.id" :video="v" />
    </div>

    <div ref="sentinel" class="loading-inline" aria-live="polite">
      <span v-if="loading" class="spinner" aria-hidden="true"></span>
      <template v-if="loading">加载中…</template>
      <template v-else-if="!hasMore && items.length > 0">已经到底了</template>
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--sp-5);
}

@media (max-width: 640px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--sp-3);
  }
}
</style>
