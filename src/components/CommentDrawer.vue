<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { deleteComment, listComments, publishComment } from '../api/comment'
import type { Comment, VideoView } from '../api/types'
import { useAuthStore } from '../stores/auth'
import { formatDate } from '../utils/format'

const props = defineProps<{
  video: VideoView | null
  toast: (msg: string) => void
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'count-change', n: number): void
}>()

const auth = useAuthStore()

const comments = ref<Comment[]>([])
const cursor = ref('')
const loading = ref(false)
const publishing = ref(false)
const input = ref('')
const inputEl = ref<HTMLTextAreaElement | null>(null)

const count = computed(() => comments.value.length)
const canPublish = computed(() => auth.isLoggedIn)

function avatarChar(name: string) {
  return (name || '?').charAt(0).toUpperCase()
}

function canDelete(c: Comment) {
  const uid = auth.account?.id
  if (!uid) return false
  return uid === c.account_id || uid === props.video?.author.id
}

async function load(initial = false) {
  const v = props.video
  if (!v || loading.value || (initial && comments.value.length)) return
  loading.value = true
  try {
    const res = await listComments(v.id, initial ? '' : cursor.value, 100)
    comments.value = initial ? [...res.comments] : [...comments.value, ...res.comments]
    cursor.value = res.cursor
    emit('count-change', comments.value.length)
  } catch (e) {
    props.toast((e as Error).message || '评论加载失败')
  } finally {
    loading.value = false
  }
}

async function submit() {
  const v = props.video
  const text = input.value.trim()
  if (!v || !text || publishing.value) return
  if (!auth.isLoggedIn) {
    props.toast('请先登录后再评论')
    return
  }
  publishing.value = true
  try {
    await publishComment(v.id, text)
    comments.value.unshift({
      id: Date.now(),
      video_id: v.id,
      author_id: v.author.id,
      account_id: auth.account?.id ?? 0,
      user_name: auth.account?.username ?? '',
      content: text,
      created_at: new Date().toISOString(),
    })
    input.value = ''
    emit('count-change', comments.value.length)
    props.toast('评论成功')
  } catch (e) {
    props.toast((e as Error).message || '发布失败')
  } finally {
    publishing.value = false
    inputEl.value?.focus()
  }
}

async function remove(c: Comment) {
  try {
    await deleteComment(c.id)
    comments.value = comments.value.filter((x) => x.id !== c.id)
    emit('count-change', comments.value.length)
    props.toast('评论已删除')
  } catch (e) {
    props.toast((e as Error).message || '删除失败')
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    void submit()
  }
}

watch(
  () => props.video?.id,
  () => {
    comments.value = []
    cursor.value = ''
    if (props.video) void load(true)
    else input.value = ''
  },
  { immediate: true },
)
</script>

<template>
  <Transition name="cd">
    <div v-if="video" class="cd-root">
      <div class="cd-backdrop" aria-hidden="true" @click="emit('close')"></div>
      <section class="cd-sheet" role="dialog" aria-modal="true" aria-label="评论">
        <div class="cd-handle" aria-hidden="true"></div>
        <header class="cd-head">
          <h2 class="cd-title">评论 <span class="cd-count">{{ count }}</span></h2>
          <button class="cd-close" aria-label="关闭评论" @click="emit('close')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div class="cd-body">
          <p v-if="loading && !comments.length" class="cd-hint">加载中…</p>
          <p v-else-if="!comments.length" class="cd-hint">还没有评论，来抢沙发</p>

          <ul v-else class="cd-list">
            <li v-for="c in comments" :key="c.id" class="cd-item">
              <span class="cd-avatar" aria-hidden="true">{{ avatarChar(c.user_name) }}</span>
              <div class="cd-main">
                <p class="cd-meta">
                  <span class="cd-name">{{ c.user_name }}</span>
                  <time class="cd-time">{{ formatDate(c.created_at) }}</time>
                  <button v-if="canDelete(c)" class="cd-del" aria-label="删除评论" @click="remove(c)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </p>
                <p class="cd-content">{{ c.content }}</p>
              </div>
            </li>
          </ul>

          <button v-if="cursor" class="cd-more" :disabled="loading" @click="load()">
            {{ loading ? '加载中…' : '加载更多' }}
          </button>
        </div>

        <footer class="cd-foot">
          <template v-if="canPublish">
            <textarea
              ref="inputEl"
              v-model="input"
              class="cd-input"
              rows="1"
              placeholder="留下你的评论…"
              :disabled="publishing"
              @keydown="onKeydown"
            ></textarea>
            <button class="cd-send" :disabled="!input.trim() || publishing" @click="submit">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
              </svg>
            </button>
          </template>
          <router-link v-else to="/login" class="cd-login">登录后参与评论</router-link>
        </footer>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.cd-root {
  position: fixed;
  inset: 0;
  z-index: 900;
}

.cd-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(6, 3, 12, 0.6);
  backdrop-filter: blur(3px);
}

.cd-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 72dvh;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-top: 1px solid var(--border-strong);
  color: var(--text);
}

.cd-handle {
  width: 44px;
  height: 5px;
  margin: 10px auto 2px;
  background: var(--border-strong);
}

.cd-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px 12px;
}

.cd-title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: 800;
}

.cd-count {
  color: var(--signal);
}

.cd-close {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-2);
  background: var(--surface-2);
  border: 1px solid var(--border);
}

.cd-close:hover {
  color: var(--signal);
  border-color: var(--signal);
}

.cd-body {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px;
  overscroll-behavior: contain;
}

.cd-hint {
  padding: 40px 0;
  text-align: center;
  color: var(--text-2);
}

.cd-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.cd-item {
  display: flex;
  gap: 12px;
}

.cd-avatar {
  flex: none;
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  color: var(--signal);
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
}

.cd-main {
  min-width: 0;
  flex: 1;
}

.cd-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 4px;
}

.cd-name {
  font-weight: 700;
  font-size: var(--font-size-sm);
  color: var(--signal);
}

.cd-time {
  font-size: var(--font-size-xs);
  color: rgba(255, 255, 255, 0.5);
}

.cd-del {
  margin-left: auto;
  padding: 4px;
  color: var(--text-3);
}

.cd-del:hover {
  color: var(--danger);
}

.cd-content {
  margin: 0;
  font-size: var(--font-size-base);
  line-height: 1.5;
  word-break: break-word;
}

.cd-more {
  width: 100%;
  margin: 20px 0 8px;
  padding: 10px;
  color: var(--signal);
  font-weight: 700;
  font-size: var(--font-size-sm);
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
}

.cd-more:hover {
  border-color: var(--signal);
}

.cd-more:disabled {
  opacity: 0.6;
}

.cd-foot {
  padding: 12px 16px calc(14px + env(safe-area-inset-bottom));
  display: flex;
  gap: 10px;
  align-items: flex-end;
  border-top: 1px solid var(--border);
  background: var(--bg);
}

.cd-input {
  flex: 1;
  resize: none;
  padding: 10px 14px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  color: var(--text);
  font-size: var(--font-size-base);
  line-height: 1.4;
  max-height: 96px;
}

.cd-input:focus {
  outline: none;
  border-color: var(--signal);
  box-shadow: 0 0 0 1px var(--signal);
}

.cd-input::placeholder {
  color: var(--text-3);
}

.cd-send {
  flex: none;
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--on-accent);
  background: var(--signal);
  border: 1px solid var(--signal);
}

.cd-send:hover:not(:disabled) {
  background: var(--signal-hover);
}

.cd-send:disabled {
  opacity: 0.4;
}

.cd-login {
  flex: 1;
  text-align: center;
  padding: 11px;
  font-weight: 700;
  color: var(--on-accent);
  background: var(--signal);
  text-decoration: none;
}

.cd-enter-active,
.cd-leave-active {
  transition: opacity var(--dur-base) var(--ease-out);
}

.cd-enter-active .cd-sheet,
.cd-leave-active .cd-sheet {
  transition: transform var(--dur-base) var(--ease-out);
}

.cd-enter-from,
.cd-leave-to {
  opacity: 0;
}

.cd-enter-from .cd-sheet,
.cd-leave-to .cd-sheet {
  transform: translateY(100%);
}
</style>
