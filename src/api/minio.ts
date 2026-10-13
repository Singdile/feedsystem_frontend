// 分片直传：浏览器把分片 PUT 到 /minio/*，由 Vite 代理转发到 MinIO，
// 保持 Host/路径/签名 query 不变，绕过浏览器跨源限制。
import SparkMD5 from 'spark-md5'

export const PART_SIZE = 5 * 1024 * 1024 // 与后端 5MB 对齐
export const CONCURRENCY = 3

// 把 presigned URL 改写为经 Vite /minio 代理的同源地址
export function proxiedUrl(url: string): string {
  const u = new URL(url)
  return `${window.location.origin}/minio${u.pathname}${u.search}`
}

export async function uploadPart(presignedUrl: string, blob: Blob): Promise<void> {
  const res = await fetch(proxiedUrl(presignedUrl), {
    method: 'PUT',
    body: blob,
    // 分片是视频，必须带 video/mp4：否则 MinIO 以 octet-stream 存储，
    // 浏览器 + nosniff 会拒绝渲染为视频（播放失败）。
    headers: { 'Content-Type': 'video/mp4' },
  })
  if (!res.ok) throw new Error(`分片上传失败 HTTP ${res.status}`)
}

// spark-md5 增量计算文件哈希（不整读进内存）
export function fileHash(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const spark = new SparkMD5.ArrayBuffer()
    const chunk = 2 * 1024 * 1024
    const reader = new FileReader()
    let pos = 0

    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.onload = () => {
      spark.append(reader.result as ArrayBuffer)
      if (pos < file.size) {
        readNext()
      } else {
        resolve(spark.end())
      }
    }

    function readNext() {
      const end = Math.min(pos + chunk, file.size)
      reader.readAsArrayBuffer(file.slice(pos, end))
      pos = end
    }
    readNext()
  })
}

export interface UploadProgress {
  done: number
  total: number
}

// 主流程：哈希 → init → 查已上传分片 → 并发补传 → complete → video_key
export async function uploadVideoFile(
  file: File,
  onProgress: (p: UploadProgress) => void,
  onStage: (stage: string) => void,
  onUploadId?: (id: string) => void,
): Promise<string> {
  onStage('计算文件哈希')
  const hash = await fileHash(file)

  onStage('初始化上传')
  const init = await (await import('./video')).initVideo({
    file_name: file.name,
    file_size: file.size,
    file_hash: hash,
  })
  onUploadId?.(init.upload_id)

  onStage('读取已上传分片')
  const status = await (await import('./video')).getUploadStatus(init.upload_id)
  const doneSet = new Set(status.uploaded_parts)
  const total = init.part_urls.length
  let done = doneSet.size
  onProgress({ done, total })

  onStage('上传分片')
  let idx = 0
  const workers = Array.from({ length: Math.min(CONCURRENCY, total) }, async () => {
    while (idx < total) {
      const i = idx++
      if (doneSet.has(i + 1)) continue
      const start = i * PART_SIZE
      const blob = file.slice(start, Math.min(start + PART_SIZE, file.size))
      await uploadPart(init.part_urls[i], blob)
      done += 1
      onProgress({ done, total })
    }
  })
  await Promise.all(workers)

  onStage('合并分片')
  const complete = await (await import('./video')).completeUpload(init.upload_id)
  return complete.video_key
}
