# feedsystem-frontend

短视频前端（Vue 3 + TypeScript + Vite），配套后端项目 [feedsystem](https://github.com/Singdile/feedsystem)。

## 技术栈

- Vue 3 + TypeScript + Vite
- Pinia（状态管理）/ Vue Router（路由）
- SSE（EventSource）实时通知
- SparkMD5 文件哈希 + 分片上传
- proxiedUrl 代理：视频/封面经 `/minio` 同源访问对象存储

## 快速启动

前置：后端项目与依赖服务（MySQL/Redis/RabbitMQ/MinIO）已启动，见后端 README。

```bash
npm install
npm run dev     # :5173，代理 /api → :8080、/minio → :9000
```

浏览器访问 `http://localhost:5173`

生产构建：

```bash
npm run build   # → dist/
npm run preview # 本地预览 dist
```

## 目录结构

```
src/
  api/          # 接口封装（feed/rating/comment/social/notification/user/video/minio）
  components/   # 组件（VideoCard/CommentDrawer/NotificationBell/NavBar/ImmersiveVideo）
  views/        # 页面（Feed/Popular/Author/MyVideos/VideoDetail/Login/Register）
  stores/       # Pinia（auth 登录态）
  router/       # 路由
```
