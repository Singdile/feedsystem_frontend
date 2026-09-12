<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { deleteVideo, getVideo } from '../api/video'
import type { VideoView } from '../api/types'
import { useAuthStore } from '../stores/auth'
import { formatDate } from '../utils/format'
import ImmersiveVideo from '../components/ImmersiveVideo.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const video = ref<VideoView | null>(null)
const error = ref('')
const loading = ref(true)
const deleting = ref(false)

const isOwner = () => video.value && auth.account && video.value.author.id === auth.account.id

onMounted(async () => {
  try {
    video.value = await getVideo(route.params.id as string)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
})

async function onDelete() {
  if (!video.value) return
  if (!window.confirm(`确定删除《${video.value.title}》吗？删除后无法恢复。`)) return
  deleting.value = true
  try {
    await deleteVideo(video.value.id)
    router.push({ name: 'my-videos' })
  } catch (e) {
    error.value = (e as Error).message
    deleting.value = false
  }
}
</script>

<template>
  <div class="page container">
    <div v-if="loading" class="loading-inline">
      <span class="spinner" aria-hidden="true"></span>加载中…
    </div>

    <div v-else-if="error || !video" class="state">
      <p class="state-title">无法查看视频</p>
      <p class="state-hint">{{ error || '视频不存在或已删除' }}</p>
      <router-link to="/" class="btn btn-ghost">返回时间线</router-link>
    </div>

    <template v-else>
      <div class="detail">
        <div class="player-box">
          <ImmersiveVideo
            :src="video.play_url"
            :poster="video.cover_url"
            mode="contain"
            :show-info="false"
            :show-fullscreen="true"
            :info="{
              title: video.title,
              author: video.author.username,
              description: video.description,
              time: formatDate(video.created_at),
            }"
          />
        </div>

        <div class="detail-body">
          <div class="detail-head">
            <div>
              <h1 class="detail-title">{{ video.title }}</h1>
              <p class="detail-byline">
                <span class="author">{{ video.author.username }}</span>
                <span aria-hidden="true">·</span>
                <time :datetime="video.created_at">{{ formatDate(video.created_at) }}</time>
              </p>
            </div>
            <button v-if="isOwner()" class="btn btn-danger" :disabled="deleting" @click="onDelete">
              {{ deleting ? '删除中…' : '删除视频' }}
            </button>
          </div>

          <p v-if="video.description" class="detail-desc">{{ video.description }}</p>
          <p v-else class="detail-desc muted">作者没有添加简介</p>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.detail {
  max-width: 880px;
  margin-inline: auto;
}

.player-box {
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-xl);
  overflow: hidden;
  background: #000;
  box-shadow: var(--shadow-lg);
}

.detail-body {
  padding: var(--sp-5) 0 var(--sp-8);
}

.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--sp-4);
}

.detail-title {
  margin: 0;
  font-size: var(--font-size-xl);
  line-height: var(--line-tight);
  word-break: break-word;
}

.detail-byline {
  margin: var(--sp-2) 0 0;
  display: flex;
  gap: var(--sp-2);
  color: var(--text-3);
  font-size: var(--font-size-sm);
}

.detail-byline .author {
  color: var(--text-2);
  font-weight: 600;
}

.detail-desc {
  margin: var(--sp-6) 0 0;
  color: var(--text-2);
  line-height: var(--line-normal);
  white-space: pre-wrap;
  word-break: break-word;
}

.detail-desc.muted {
  color: var(--text-3);
}
</style>
