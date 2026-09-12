<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { deleteVideo, listVideos } from '../api/video'
import type { VideoView } from '../api/types'
import { useAuthStore } from '../stores/auth'
import VideoCard from '../components/VideoCard.vue'

const auth = useAuthStore()

const items = ref<VideoView[]>([])
const nextCursor = ref('')
const loading = ref(false)
const error = ref('')
const done = ref(false)
const sentinel = ref<HTMLElement | null>(null)
const deletingId = ref<number | null>(null)

async function loadMore() {
  if (loading.value || done.value) return
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

let observer: IntersectionObserver | null = null

onMounted(() => {
  loadMore()
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((en) => en.isIntersecting)) loadMore()
    },
    { rootMargin: '600px 0px' },
  )
  if (sentinel.value) observer.observe(sentinel.value)
})

onUnmounted(() => observer?.disconnect())
</script>

<template>
  <div class="page container">
    <div class="section-head">
      <h2>我的视频</h2>
      <router-link to="/publish" class="btn btn-primary btn-sm">发布新视频</router-link>
    </div>

    <div v-if="error" class="alert alert-error" role="alert">{{ error }}</div>

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

    <div ref="sentinel" class="loading-inline" aria-live="polite">
      <span v-if="loading" class="spinner" aria-hidden="true"></span>
      <template v-if="loading">加载中…</template>
      <template v-else-if="done && items.length > 0">已经到底了</template>
    </div>
  </div>
</template>

<style scoped>
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
</style>
