<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

export interface VideoInfo {
  title: string
  author: string
  description?: string
  time?: string
}

const props = withDefaults(
  defineProps<{
    src: string
    poster?: string
    info?: VideoInfo
    mode?: 'cover' | 'contain'
    showInfo?: boolean
    showFullscreen?: boolean
    preload?: 'none' | 'metadata' | 'auto'
    muted?: boolean
  }>(),
  { mode: 'contain', showInfo: false, showFullscreen: true, preload: 'metadata', muted: false },
)

const emit = defineEmits<{ (e: 'state', v: { paused: boolean }): void }>()

const root = ref<HTMLElement | null>(null)
const video = ref<HTMLVideoElement | null>(null)
const timeline = ref<HTMLElement | null>(null)

const paused = ref(true)
const current = ref(0)
const duration = ref(0)
const buffered = ref(0)
const controlsVisible = ref(true)
const isFull = ref(false)
const seeking = ref(false)
const dragging = ref(false)
const isMuted = ref(props.muted)

const IDLE_MS = 2500
let hideTimer: ReturnType<typeof setTimeout> | null = null

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) s = 0
  const m = Math.floor(s / 60)
  const sec = String(Math.floor(s % 60)).padStart(2, '0')
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}:${String(m % 60).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

const timeText = computed(() => `${fmt(current.value)} / ${fmt(duration.value)}`)
const progressPct = computed(() => (duration.value ? (current.value / duration.value) * 100 : 0))
const bufferedPct = computed(() => (duration.value ? (buffered.value / duration.value) * 100 : 0))

function showControls() {
  controlsVisible.value = true
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    if (!paused.value) controlsVisible.value = false
  }, IDLE_MS)
}

function onMove() {
  showControls()
}

function onLeave() {
  if (hideTimer) clearTimeout(hideTimer)
  controlsVisible.value = paused.value
}

function updateBuffered() {
  const v = video.value
  if (!v) return
  const b = v.buffered
  buffered.value = b.length ? b.end(b.length - 1) : 0
}

function effDur(): number {
  const v = video.value
  if (!v) return 0
  const d = v.duration
  if (d !== undefined && isFinite(d) && d > 0) return d
  const s = v.seekable
  return s && s.length ? s.end(s.length - 1) : 0
}

function syncMeta() {
  const d = effDur()
  if (d) duration.value = d
  updateBuffered()
}

function onTime() {
  const v = video.value
  if (!v) return
  current.value = v.currentTime
  if (!duration.value) syncMeta()
  updateBuffered()
}

function onPlay() {
  paused.value = false
  emit('state', { paused: false })
  showControls()
}

function onPause() {
  paused.value = true
  controlsVisible.value = true
  emit('state', { paused: true })
}

function togglePlay() {
  const v = video.value
  if (!v) return
  if (v.paused) void v.play().catch(() => {})
  else v.pause()
}

function play() {
  void video.value?.play().catch(() => {})
}

function pause() {
  video.value?.pause()
}

defineExpose({ play, pause, togglePlay })

function seekTo(clientX: number) {
  const tl = timeline.value
  const v = video.value
  if (!tl || !v) return
  const dur = effDur()
  if (!dur) return
  const r = tl.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
  v.currentTime = ratio * dur
  current.value = v.currentTime
}

function onTlKey(e: KeyboardEvent) {
  const v = video.value
  if (!v) return
  const dur = effDur()
  let t = v.currentTime
  if (e.key === 'ArrowRight') t += e.shiftKey ? 10 : 5
  else if (e.key === 'ArrowLeft') t -= e.shiftKey ? 10 : 5
  else if (e.key === 'Home') t = 0
  else if (e.key === 'End') t = dur || 0
  else return
  e.preventDefault()
  if (dur) t = Math.min(Math.max(0, t), dur)
  v.currentTime = t
  current.value = v.currentTime
}

function toggleMute() {
  const v = video.value
  if (!v) return
  v.muted = !v.muted
  isMuted.value = v.muted
}

function onTlDown(e: PointerEvent) {
  dragging.value = true
  seeking.value = true
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  seekTo(e.clientX)
}

function onTlMove(e: PointerEvent) {
  if (!seeking.value) return
  seekTo(e.clientX)
}

function onTlUp() {
  seeking.value = false
  setTimeout(() => {
    dragging.value = false
  }, 0)
}

async function toggleFull() {
  if (isFull.value) {
    await document.exitFullscreen().catch(() => {})
  } else if (root.value) {
    await root.value.requestFullscreen().catch(() => {})
    void video.value?.play().catch(() => {})
  }
}

function onFullChange() {
  isFull.value = !!document.fullscreenElement && document.fullscreenElement === root.value
  if (!isFull.value) showControls()
}

onMounted(() => {
  document.addEventListener('fullscreenchange', onFullChange)
})

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', onFullChange)
  if (hideTimer) clearTimeout(hideTimer)
})
</script>

<template>
  <div
    ref="root"
    class="imm"
    :class="[`mode-${props.mode}`, { 'is-full': isFull, 'show-info': props.showInfo || isFull }]"
    @mousemove="onMove"
    @mouseleave="onLeave"
  >
    <video
      ref="video"
      class="imm-video"
      :src="props.src"
      :poster="props.poster"
      :preload="props.preload"
      :muted="isMuted"
      loop
      playsinline
      @click="togglePlay"
      @loadedmetadata="syncMeta"
      @durationchange="syncMeta"
      @loadeddata="syncMeta"
      @canplay="syncMeta"
      @progress="updateBuffered"
      @timeupdate="onTime"
      @play="onPlay"
      @pause="onPause"
    ></video>

    <div v-if="props.showInfo || isFull" class="shade" aria-hidden="true"></div>

    <div v-if="props.showInfo || isFull" class="imm-info">
      <p class="author">
        <span class="avatar" aria-hidden="true">{{ props.info?.author?.charAt(0) }}</span>
        <span>{{ props.info?.author }}</span>
      </p>
      <h1 class="title">{{ props.info?.title }}</h1>
      <p v-if="props.info?.description" class="desc">{{ props.info.description }}</p>
      <time v-if="props.info?.time" class="time">{{ props.info.time }}</time>
    </div>

    <div v-if="paused && !dragging" class="big-play" @click="togglePlay">
      <svg width="56" height="56" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M8 5v14l11-7z" />
      </svg>
    </div>

    <div class="controls" :class="{ show: controlsVisible }">
      <div
        ref="timeline"
        class="tl"
        role="slider"
        tabindex="0"
        aria-label="播放进度"
        :aria-valuenow="Math.round(progressPct)"
        :aria-valuemin="0"
        :aria-valuemax="100"
        @pointerdown="onTlDown"
        @pointermove="onTlMove"
        @pointerup="onTlUp"
        @pointercancel="onTlUp"
        @keydown="onTlKey"
      >
        <div class="tl-buffered" :style="{ width: `${bufferedPct}%` }" aria-hidden="true"></div>
        <div class="tl-progress" :style="{ width: `${progressPct}%` }" aria-hidden="true"></div>
        <div class="tl-thumb" :style="{ left: `${progressPct}%` }" aria-hidden="true"></div>
      </div>
      <div class="row">
        <button class="cc-btn" :aria-label="paused ? '播放' : '暂停'" @click="togglePlay">
          <svg v-if="paused" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
          </svg>
        </button>
        <span class="time-text">{{ timeText }}</span>
        <span class="spacer"></span>
        <button class="cc-btn" :aria-label="isMuted ? '取消静音' : '静音'" @click="toggleMute">
          <svg v-if="isMuted" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 10v4h4l5 5V5L7 10H3z" />
            <path d="M16 8l6 8M22 8l-6 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" />
          </svg>
          <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M3 10v4h4l5 5V5L7 10H3z" />
            <path d="M16.5 8.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            <path d="M19 6a9 9 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
        <button v-if="props.showFullscreen" class="cc-btn" :aria-label="isFull ? '退出全屏' : '全屏沉浸' " @click="toggleFull">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <template v-if="isFull">
              <path d="M9 21v-6H3" />
              <path d="M21 15h-6V9" />
              <path d="M3 15v3a3 3 0 0 0 3 3h3" />
              <path d="M21 9v-3a3 3 0 0 0-3-3h-3" />
            </template>
            <template v-else>
              <path d="M15 3h6v6" />
              <path d="M9 21H3v-6" />
              <path d="M21 3l-7 7" />
              <path d="M3 21l7-7" />
            </template>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.imm {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  overflow: hidden;
}

.imm-video {
  width: 100%;
  height: 100%;
  display: block;
  background: #000;
  cursor: pointer;
}

.mode-cover .imm-video,
.imm.is-full .imm-video {
  object-fit: cover;
}

.mode-contain .imm-video {
  object-fit: contain;
}

.shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.18) 0%,
    transparent 30%,
    transparent 55%,
    rgba(0, 0, 0, 0.62) 100%
  );
  pointer-events: none;
}

.imm-info {
  position: absolute;
  left: 16px;
  right: 76px;
  bottom: 120px;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.65);
}

.author {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 8px;
  font-weight: 600;
}

.avatar {
  width: 34px;
  height: 34px;
  border-radius: var(--radius-full);
  background: var(--accent);
  color: var(--on-accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex: none;
}

.title {
  margin: 0 0 6px;
  font-size: var(--font-size-xl);
  line-height: var(--line-tight);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.desc {
  margin: 0 0 6px;
  color: rgba(255, 255, 255, 0.9);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.time {
  font-size: var(--font-size-sm);
  color: rgba(255, 255, 255, 0.72);
}

.big-play {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 88px;
  height: 88px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.92);
  border-radius: var(--radius-full);
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
  cursor: pointer;
  transition: var(--trans-transform);
  z-index: 4;
}

.big-play:hover {
  transform: scale(1.06);
}

/* 底部控制条：鼠标移动显示，静止隐藏 */
.controls {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 5;
  padding: 24px 16px 10px;
  background: linear-gradient(0deg, rgba(0, 0, 0, 0.5) 0%, transparent 100%);
  opacity: 0;
  transition: var(--trans-opacity);
}

.controls.show {
  opacity: 1;
}

.tl {
  position: relative;
  height: 28px;
  display: flex;
  align-items: center;
  cursor: pointer;
  touch-action: none;
}

.tl::before,
.tl-buffered,
.tl-progress {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  height: 3px;
  border-radius: var(--radius-full);
}

.tl::before {
  content: '';
  right: 0;
  background: rgba(255, 255, 255, 0.3);
}

.tl-buffered {
  background: rgba(255, 255, 255, 0.4);
}

.tl-progress {
  background: var(--accent);
}

.tl-thumb {
  position: absolute;
  top: 50%;
  left: 0;
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full);
  background: #fff;
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: var(--trans-opacity);
}

.tl:hover .tl-thumb,
.tl:active .tl-thumb,
.tl:focus-visible .tl-thumb {
  opacity: 1;
}

.tl:focus-visible {
  outline: none;
}

.tl:focus-visible::before {
  height: 5px;
}

.row {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  color: rgba(255, 255, 255, 0.95);
}

.spacer {
  flex: 1;
}

.cc-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.95);
  background: rgba(0, 0, 0, 0.3);
  transition: var(--trans-colors);
}

.cc-btn:hover {
  background: rgba(0, 0, 0, 0.55);
}

.time-text {
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 640px) {
  .imm-info {
    left: 12px;
    right: 64px;
    bottom: 108px;
  }
}
</style>
