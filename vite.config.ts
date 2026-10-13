import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      // 后端 API（与前端同源，避免 API 侧 CORS）
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // MinIO 直传代理：前端把分片 PUT 到 /minio/* 由本代理转发到 MinIO，
      // 转发时保持 Host/路径/签名 query 不变，绕过浏览器跨源限制。
      '/minio': {
        target: 'http://localhost:9000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/minio/, ''),
        configure: (proxy) => {
          // 现有对象可能以 application/octet-stream 存储（上传时未带 Content-Type），
          // 浏览器 + nosniff 会拒绝渲染为视频。这里对 .mp4 响应强制回写 video/mp4，
          // 让播放器能正常解码；生产环境应在对象存储侧设置正确 Content-Type。
          // 无 @types/node，ProxyServer 类型不带 EventEmitter 方法 → 结构化类型转换
          ;(proxy as unknown as { on(event: string, cb: (proxyRes: { headers: Record<string, string | undefined> }, req: { url?: string }) => void): void }).on(
            'proxyRes',
            (proxyRes, req) => {
              if ((req.url || '').includes('.mp4')) {
                proxyRes.headers['content-type'] = 'video/mp4'
              }
            },
          )
        },
      },
    },
  },
})
