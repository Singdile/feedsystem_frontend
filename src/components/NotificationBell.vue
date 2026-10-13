<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  getUnreadCount,
  listNotifications,
  markNotificationsRead,
  notificationStreamUrl,
} from '../api/notification'
import { getUsers } from '../api/user'
import { getVideo } from '../api/video'
import type { Notification } from '../api/types'
import { useAuthStore } from '../stores/auth'
import { formatDate } from '../utils/format'

const auth = useAuthStore()

const open = ref(false)
const unread = ref(0)
const items = ref<Notification[]>([])
const cursor = ref('')
const hasMore = ref(true)
const loading = ref(false)
const loaded = ref(false)
const panelEl = ref<HTMLElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
const senders = ref<Record<number, string>>({})
const titles = ref<Record<number, string>>({})

const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string) {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2200)
}

function typeLabel(n: Notification) {
  return { like: '赞', comment: '评', follow: '关', mention: '提' }[n.type] || '讯'
}

function senderName(n: Notification) {
  return senders.value[n.sender_id] ?? `用户${n.sender_id}`
}

function title(n: Notification) {
  return n.type === 'follow' ? '' : (titles.value[n.target_id] ?? '')
}

function notifTarget(n: Notification) {
  if (n.type === 'follow') return { name: 'author', params: { id: n.target_id } }
  return { name: 'video-detail', params: { id: n.target_id } }
}

async function loadCount() {
  if (!auth.isLoggedIn) return
  try {
    unread.value = await getUnreadCount()
  } catch {
    // 静默
  }
}

async function resolveNames() {
  const needSender = [
    ...new Set(items.value.map((n) => n.sender_id).filter((id) => senders.value[id] === undefined)),
  ]
  const needTitle = [
    ...new Set(
      items.value
        .filter((n) => n.type !== 'follow')
        .map((n) => n.target_id)
        .filter((id) => titles.value[id] === undefined),
    ),
  ]
  if (needSender.length) {
    const users = await getUsers(needSender)
    const m = { ...senders.value }
    users.forEach((u, i) => {
      if (u) m[needSender[i]] = u.username
    })
    senders.value = m
  }
  if (needTitle.length) {
    needTitle.forEach((id) => {
      getVideo(id)
        .then((v) => {
          titles.value = { ...titles.value, [id]: v.title }
        })
        .catch(() => {})
    })
  }
}

async function load(initial = false) {
  if (!auth.isLoggedIn || loading.value || (initial && loaded.value)) return
  loading.value = true
  try {
    const res = await listNotifications(initial ? '' : cursor.value, 20)
    items.value = initial ? res.notifications : [...items.value, ...res.notifications]
    cursor.value = res.next_cursor
    hasMore.value = !!res.next_cursor
    if (initial) loaded.value = true
    resolveNames()
  } catch {
    // 静默
  } finally {
    loading.value = false
  }
}

async function togglePanel() {
  open.value = !open.value
  if (open.value && !loaded.value) await load(true)
}

async function markOne(n: Notification) {
  if (n.is_read) return
  await markNotificationsRead(n.id).catch(() => {})
  n.is_read = true
  unread.value = Math.max(0, unread.value - 1)
}

async function markAll() {
  if (unread.value === 0) return
  await markNotificationsRead(0).catch(() => {})
  items.value.forEach((n) => (n.is_read = true))
  unread.value = 0
  showToast('已全部标记为已读')
}

function onListScroll() {
  const el = listEl.value
  if (!el) return
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) load(false)
}

let es: EventSource | null = null

function stream() {
  es?.close()
  if (!auth.isLoggedIn) return
  // 测试钩子：headless 下 SSE 长连接会卡住虚拟时间，探针可通过 localStorage 关闭
  if (localStorage.getItem('feedsystem:no-sse') === '1') return
  es = new EventSource(notificationStreamUrl())
  es.onmessage = (ev) => {
    try {
      const n = JSON.parse(ev.data) as Notification
      items.value = [n, ...items.value.filter((x) => x.id !== n.id)]
      unread.value += 1
      loaded.value = true
      resolveNames()
      showToast('收到一条新通知')
    } catch {
      // 解析失败忽略
    }
  }
  // onerror：EventSource 默认自动重连
}

function onDocClick(e: MouseEvent) {
  if (panelEl.value && !panelEl.value.contains(e.target as Node)) open.value = false
}

watch(
  () => auth.isLoggedIn,
  (v) => {
    open.value = false
    items.value = []
    cursor.value = ''
    hasMore.value = true
    loaded.value = false
    unread.value = 0
    if (v) {
      loadCount()
      stream()
    } else {
      es?.close()
    }
  },
)

onMounted(() => {
  document.addEventListener('mousedown', onDocClick)
  loadCount()
  stream()
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick)
  es?.close()
})
</script>

<template>
  <div ref="panelEl" class="notif">
    <button class="notif-bell" aria-label="通知" @click.stop="togglePanel">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
        <path
          d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span v-if="unread > 0" class="notif-badge">{{ unread > 99 ? '99+' : unread }}</span>
    </button>

    <Transition name="npop">
      <div v-if="open" class="notif-panel">
        <header class="notif-head">
          <h3 class="notif-title">通知</h3>
          <button class="notif-markall" :disabled="unread === 0" @click="markAll">全部已读</button>
        </header>

        <div ref="listEl" class="notif-list" @scroll="onListScroll">
          <div v-if="!items.length && !loading" class="notif-empty">暂无通知</div>

          <router-link
            v-for="n in items"
            :key="n.id"
            :to="notifTarget(n)"
            class="notif-item"
            :class="{ 'is-unread': !n.is_read }"
            @click="markOne(n)"
          >
            <span class="notif-chip" :class="'type-' + n.type">{{ typeLabel(n) }}</span>
            <span class="notif-body">
              <span class="notif-text">
                <b>{{ senderName(n) }}</b> {{ n.content }}<template v-if="title(n)">《{{ title(n) }}》</template>
              </span>
              <span class="notif-time">{{ formatDate(n.created_at) }}</span>
            </span>
            <span v-if="!n.is_read" class="notif-dot" aria-hidden="true"></span>
          </router-link>

          <div v-if="loading" class="notif-foot">加载中…</div>
          <div v-else-if="!hasMore && items.length" class="notif-foot">没有更多了</div>
        </div>
      </div>
    </Transition>

    <Transition name="toast">
      <div v-if="toast" class="notif-toast" role="status">{{ toast }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.notif {
  position: relative;
}

.notif-bell {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-2);
  transition: var(--trans-colors), var(--trans-transform);
}

.notif-bell:hover {
  color: var(--signal);
  border-color: var(--signal);
  transform: translateY(-1px);
}

.notif-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: var(--signal);
  color: var(--on-accent);
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
  border: 1px solid var(--bg);
}

.notif-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 10px);
  width: 340px;
  max-width: calc(100vw - 24px);
  background: var(--surface);
  border: 1px solid var(--border-strong);
  overflow: hidden;
  z-index: var(--z-modal);
}

.notif-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--sp-3) var(--sp-4);
  border-bottom: 1px solid var(--border);
}

.notif-title {
  margin: 0;
  font-size: var(--font-size-base);
}

.notif-markall {
  font-size: var(--font-size-xs);
  color: var(--signal);
  font-weight: 600;
}

.notif-markall:disabled {
  color: var(--text-3);
  cursor: default;
}

.notif-list {
  max-height: 380px;
  overflow-y: auto;
}

.notif-empty {
  padding: var(--sp-8) var(--sp-4);
  text-align: center;
  color: var(--text-3);
  font-size: var(--font-size-sm);
}

.notif-item {
  display: flex;
  align-items: flex-start;
  gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-4);
  border-bottom: 1px solid var(--border);
  color: inherit;
}

.notif-item:hover {
  background: var(--surface-2);
}

.notif-item.is-unread {
  background: var(--signal-soft);
}

.notif-chip {
  flex: none;
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  font-weight: 800;
  color: var(--on-accent);
  background: var(--signal);
  border: 1px solid var(--bg);
}

.type-like,
.type-comment,
.type-follow,
.type-mention {
  background: var(--signal);
}

.notif-body {
  flex: 1;
  min-width: 0;
}

.notif-text {
  display: block;
  font-size: var(--font-size-sm);
  line-height: var(--line-normal);
  word-break: break-word;
}

.notif-text b {
  color: var(--signal);
}

.notif-time {
  display: block;
  margin-top: 2px;
  font-size: var(--font-size-xs);
  color: var(--text-3);
}

.notif-dot {
  flex: none;
  width: 8px;
  height: 8px;
  margin-top: 6px;
  background: var(--signal);
}

.notif-foot {
  padding: var(--sp-3);
  text-align: center;
  color: var(--text-3);
  font-size: var(--font-size-xs);
}

.notif-toast {
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

.npop-enter-active,
.npop-leave-active {
  transition: opacity var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
}

.npop-enter-from,
.npop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
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
