<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { deleteVideo, getVideo } from '../api/video'
import type { VideoView } from '../api/types'
import { getRating, getRatingCounts, setRating } from '../api/rating'
import { listComments } from '../api/comment'
import { follow, isFollowed, unfollow } from '../api/social'
import { useAuthStore } from '../stores/auth'
import { formatDate } from '../utils/format'
import { proxiedUrl } from '../api/minio'
import ImmersiveVideo from '../components/ImmersiveVideo.vue'
import CommentDrawer from '../components/CommentDrawer.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const video = ref<VideoView | null>(null)
const error = ref('')
const loading = ref(true)
const deleting = ref(false)
const followed = ref<boolean | null>(null)
const followActing = ref(false)
const commentOpen = ref(false)

const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string) {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2200)
}

const isOwner = () => video.value && auth.account && video.value.author.id === auth.account.id

// 详情接口不盖章计数 → 登录时补拉点赞计数/状态；评论数从列表长度取
async function loadExtras(id: number) {
  listComments(id, '', 100)
    .then((res) => {
      if (video.value?.id === id) video.value.comment_count = res.comments.length
    })
    .catch(() => {})

  followed.value = null
  if (!video.value) return
  if (auth.isLoggedIn && !isOwner()) {
    isFollowed(video.value.author.id)
      .then((f) => {
        if (video.value?.id === id) followed.value = f
      })
      .catch(() => {})
  }
  if (auth.isLoggedIn) {
    try {
      const [counts, stat] = await Promise.all([getRatingCounts(id), getRating(id)])
      if (video.value?.id === id) {
        video.value.liked_count = counts.liked_count
        video.value.disliked_count = counts.disliked_count
        video.value.status = stat
      }
    } catch {
      // 计数接口异常静默降级
    }
  }
}

async function load() {
  const id = route.params.id as string
  loading.value = true
  error.value = ''
  commentOpen.value = false
  try {
    video.value = await getVideo(id)
    loadExtras(Number(id))
  } catch (e) {
    error.value = (e as Error).message
    video.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => route.params.id, load)

async function toggleLike() {
  const v = video.value
  if (!v) return
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
    v.status = stat
    v.liked_count = liked
  } catch (e) {
    showToast((e as Error).message || '点赞失败')
  }
}

async function toggleFollow() {
  const v = video.value
  if (!v) return
  if (!auth.isLoggedIn) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }
  if (followActing.value) return
  followActing.value = true
  try {
    if (followed.value) {
      await unfollow(v.author.id)
      followed.value = false
      showToast('已取消关注')
    } else {
      await follow(v.author.id)
      followed.value = true
      showToast(`已关注 @${v.author.username}`)
    }
  } catch (e) {
    showToast((e as Error).message || '操作失败')
  } finally {
    followActing.value = false
  }
}

async function shareLink() {
  if (!video.value) return
  try {
    await navigator.clipboard.writeText(`${location.origin}/videos/${video.value.id}`)
    showToast('视频链接已复制')
  } catch {
    showToast('复制失败，请手动复制链接')
  }
}

function onCommentCount(n: number) {
  if (video.value) video.value.comment_count = n
}

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
            :src="proxiedUrl(video.play_url)"
            :poster="video.cover_url ? proxiedUrl(video.cover_url) : undefined"
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
                <router-link
                  class="author"
                  :to="{ name: 'author', params: { id: video.author.id }, query: { name: video.author.username } }"
                >
                  @{{ video.author.username }}
                </router-link>
                <span aria-hidden="true">·</span>
                <time :datetime="video.created_at">{{ formatDate(video.created_at) }}</time>
              </p>
            </div>
            <div class="head-actions">
              <button
                v-if="!isOwner()"
                class="btn btn-sm"
                :class="followed ? 'btn-ghost' : 'btn-primary'"
                :disabled="followActing || followed === null"
                @click="toggleFollow"
              >
                <template v-if="followed === null">关注</template>
                <template v-else-if="followActing">…</template>
                <template v-else-if="followed">已关注</template>
                <template v-else>+ 关注</template>
              </button>
              <button v-if="isOwner()" class="btn btn-danger" :disabled="deleting" @click="onDelete">
                {{ deleting ? '删除中…' : '删除视频' }}
              </button>
            </div>
          </div>

          <div class="actions" aria-label="互动">
            <button
              class="action-btn"
              :class="{ 'is-liked': video.status === 1 }"
              aria-label="点赞"
              @click="toggleLike"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path
                  d="M12 21s-7.5-4.7-10-9.2C.5 8.6 2.2 5.5 5.2 5.1c1.8-.2 3.6.6 4.8 2.1L12 9.4l2-2.2c1.2-1.5 3-2.3 4.8-2.1 3 .4 4.7 3.5 3.2 6.7C19.5 16.3 12 21 12 21z"
                />
              </svg>
              {{ video.liked_count > 0 ? video.liked_count : '赞' }}
            </button>
            <button class="action-btn" aria-label="评论" @click="commentOpen = true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path
                  d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4.5 3.2A.8.8 0 0 1 3 18.5V6z"
                />
              </svg>
              {{ video.comment_count > 0 ? video.comment_count : '评论' }}
            </button>
            <button class="action-btn" aria-label="分享" @click="shareLink">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path
                  d="M18 8a3 3 0 1 0-.6-5.9 3 3 0 0 0 .6 5.9zM6 15a3 3 0 1 0-.6-5.9A3 3 0 0 0 6 15zM18 21a3 3 0 1 0-.6-5.9A3 3 0 0 0 18 21zM8.4 13.7l7.2 4.3m-7.2-7l7.2-4.3"
                />
              </svg>
              分享
            </button>
          </div>

          <p v-if="video.description" class="detail-desc">{{ video.description }}</p>
          <p v-else class="detail-desc muted">作者没有添加简介</p>

          <p v-if="video.hash_tags && video.hash_tags.length" class="detail-tags">
            <span v-for="t in video.hash_tags" :key="t" class="chip">#{{ t }}</span>
          </p>
        </div>
      </div>
    </template>

    <!-- 评论抽屉（复用时间线同款） -->
    <CommentDrawer
      :video="commentOpen ? video : null"
      :toast="showToast"
      @close="commentOpen = false"
      @count-change="onCommentCount"
    />

    <Transition name="toast">
      <div v-if="toast" class="toast" role="status">{{ toast }}</div>
    </Transition>
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

.head-actions {
  display: flex;
  gap: var(--sp-2);
  flex: none;
}

.actions {
  display: flex;
  gap: var(--sp-3);
  margin-top: var(--sp-5);
  flex-wrap: wrap;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 16px;
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--text-2);
  font-size: var(--font-size-sm);
  font-weight: 700;
  transition: var(--trans-colors), var(--trans-transform);
}

.action-btn:hover {
  border-color: var(--cyan);
  color: var(--text);
  transform: translateY(-1px);
}

.action-btn.is-liked {
  border-color: var(--signal);
  color: var(--signal);
  background: var(--signal-soft);
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

.detail-tags {
  margin: var(--sp-4) 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--cyan);
  padding: 3px 10px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border);
  background: var(--surface-2);
}

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
</style>
