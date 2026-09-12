<script setup lang="ts">
import { ref } from 'vue'
import type { VideoView } from '../api/types'
import { formatDate } from '../utils/format'

defineProps<{ video: VideoView }>()

const imgError = ref(false)
const loaded = ref(false)
</script>

<template>
  <router-link :to="`/videos/${video.id}`" class="video-card">
    <div class="thumb">
      <div v-if="!loaded && !imgError" class="thumb-skeleton" aria-hidden="true"></div>
      <img
        v-if="!imgError"
        :src="video.cover_url"
        :alt="video.title"
        loading="lazy"
        @load="loaded = true"
        @error="imgError = true"
      />
      <div v-else class="thumb-fallback" aria-hidden="true">{{ video.title.charAt(0) }}</div>
      <span class="play-badge" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </div>
    <div class="meta">
      <h3 class="title">{{ video.title }}</h3>
      <p class="byline">{{ video.author.username }} · {{ formatDate(video.created_at) }}</p>
    </div>
  </router-link>
</template>

<style scoped>
.video-card {
  display: block;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--surface);
  transition: var(--trans-transform), var(--trans-colors);
}

.video-card:hover {
  transform: translateY(-2px);
}

.video-card:hover .thumb img {
  transform: scale(1.03);
}

.thumb {
  position: relative;
  aspect-ratio: var(--thumb-ratio);
  background: var(--surface-2);
  overflow: hidden;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: var(--trans-transform);
}

.thumb-skeleton {
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, var(--surface-2) 40%, var(--surface-hover) 50%, var(--surface-2) 60%);
  background-size: 200% 100%;
  animation: shimmer 1.2s linear infinite;
}

@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}

.thumb-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--text-3);
}

.play-badge {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
  background: oklch(0% 0 0 / 0);
  opacity: 0;
  transition: var(--trans-opacity);
}

.video-card:hover .play-badge,
.video-card:focus-visible .play-badge {
  opacity: 1;
  background: oklch(0% 0 0 / 0.32);
}

.meta {
  padding: var(--sp-3);
}

.title {
  margin: 0 0 var(--sp-1);
  font-size: var(--font-size-base);
  font-weight: 600;
  line-height: var(--line-tight);
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.byline {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--text-3);
}
</style>
