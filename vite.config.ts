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
      },
    },
  },
})
