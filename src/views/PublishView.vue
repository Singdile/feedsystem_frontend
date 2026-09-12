<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { publish, uploadCover } from '../api/video'
import { uploadVideoFile } from '../api/minio'
import type { UploadProgress } from '../api/minio'
import { formatBytes } from '../utils/format'

const router = useRouter()

const title = ref('')
const description = ref('')
const videoFile = ref<File | null>(null)
const coverFile = ref<File | null>(null)
const coverPreview = ref('')

const busy = ref(false)
const stageText = ref('')
const progress = ref<UploadProgress>({ done: 0, total: 0 })
const error = ref('')

const percent = computed(() => {
  if (progress.value.total === 0) return 0
  return Math.round((progress.value.done / progress.value.total) * 100)
})

const canStart = computed(
  () => title.value.trim() && videoFile.value && coverFile.value && !busy.value,
)

const MAX_SIZE = 2 * 1024 * 1024 * 1024 // 2GB，与后端一致

function onVideoPicked(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  if (f.size > MAX_SIZE) {
    error.value = '视频不能超过 2GB'
    return
  }
  error.value = ''
  videoFile.value = f
}

function onCoverPicked(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  if (!f.type.startsWith('image/')) {
    error.value = '封面需要是图片文件'
    return
  }
  error.value = ''
  if (coverPreview.value) URL.revokeObjectURL(coverPreview.value)
  coverFile.value = f
  coverPreview.value = URL.createObjectURL(f)
}

async function onSubmit() {
  if (!canStart.value) return
  busy.value = true
  error.value = ''
  try {
    const vf = videoFile.value!
    const cf = coverFile.value!

    stageText.value = '上传封面'
    const cover = await uploadCover(cf)

    const videoKey = await uploadVideoFile(vf, (p) => (progress.value = p), (s) => (stageText.value = s))

    stageText.value = '提交发布'
    const res = await publish({
      title: title.value.trim(),
      description: description.value.trim() || undefined,
      video_key: videoKey,
      cover_key: cover.cover_key,
    })

    router.push({ name: 'video-detail', params: { id: res.id } })
  } catch (e) {
    error.value = (e as Error).message
    busy.value = false
    stageText.value = ''
  }
}
</script>

<template>
  <div class="page container">
    <div class="publish">
      <h1 class="publish-title">发布视频</h1>
      <p class="publish-sub">填写信息，上传视频与封面，提交后即可出现在时间线。</p>

      <div v-if="error" class="alert alert-error" role="alert">{{ error }}</div>

      <!-- 步骤 1：信息 -->
      <section class="panel" aria-label="视频信息">
        <div class="field">
          <label for="title">标题</label>
          <input id="title" v-model="title" class="input" placeholder="给视频起个标题" maxlength="255" />
        </div>

        <div class="field">
          <label for="desc">简介（可选）</label>
          <textarea id="desc" v-model="description" class="textarea" placeholder="补充说明一下内容…" maxlength="1000"></textarea>
        </div>
      </section>

      <!-- 步骤 2：文件 -->
      <section class="panel" aria-label="选择文件">
        <div class="field">
          <label for="video-file">视频文件</label>
          <input id="video-file" class="file-input" type="file" accept="video/*" :disabled="busy" @change="onVideoPicked" />
          <p v-if="videoFile" class="file-hint" role="status">
            已选择：{{ videoFile.name }}（{{ formatBytes(videoFile.size) }}）
          </p>
          <p v-else class="file-hint">支持 mp4 / webm / mov 等，不超过 2GB，将自动分片上传</p>
        </div>

        <div class="field">
          <label for="cover-file">封面图</label>
          <input id="cover-file" class="file-input" type="file" accept="image/*" :disabled="busy" @change="onCoverPicked" />
          <div v-if="coverPreview" class="cover-preview">
            <img :src="coverPreview" alt="封面预览" />
          </div>
        </div>
      </section>

      <!-- 上传进度 -->
      <section v-if="busy" class="panel" aria-live="polite">
        <p class="progress-label">{{ stageText }}</p>
        <div class="progress" aria-hidden="true">
          <div class="progress-bar" :style="{ width: `${percent}%` }"></div>
        </div>
        <p class="progress-percent">{{ percent }}%（{{ progress.done }}/{{ progress.total }} 分片）</p>
      </section>

      <button class="btn btn-primary submit-btn" :disabled="!canStart" @click="onSubmit">
        <span v-if="busy" class="spinner" aria-hidden="true"></span>
        {{ busy ? '上传中…' : '发布' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.publish {
  max-width: 560px;
  margin-inline: auto;
}

.publish-title {
  margin: 0;
  font-size: var(--font-size-2xl);
  line-height: var(--line-tight);
}

.publish-sub {
  margin: var(--sp-2) 0 var(--sp-6);
  color: var(--text-3);
  font-size: var(--font-size-sm);
}

.panel {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--sp-6);
  margin-bottom: var(--sp-5);
}

.file-input {
  font-size: var(--font-size-sm);
  color: var(--text-2);
}

.file-input::file-selector-button {
  font: inherit;
  font-weight: 600;
  color: var(--text);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 0.5rem var(--sp-4);
  margin-right: var(--sp-3);
  cursor: pointer;
  transition: var(--trans-colors);
}

.file-input::file-selector-button:hover {
  background: var(--surface-hover);
}

.file-hint {
  margin: var(--sp-2) 0 0;
  font-size: var(--font-size-sm);
  color: var(--text-3);
}

.cover-preview {
  margin-top: var(--sp-3);
  width: 200px;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--border);
}

.cover-preview img {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.progress-label {
  margin: 0 0 var(--sp-3);
  font-weight: 600;
}

.progress-percent {
  margin: var(--sp-2) 0 0;
  font-size: var(--font-size-sm);
  color: var(--text-3);
}

.submit-btn {
  width: 100%;
}
</style>
