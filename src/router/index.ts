import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'feed', component: () => import('../views/FeedView.vue') },
    { path: '/popular', name: 'popular', component: () => import('../views/PopularView.vue') },
    { path: '/u/:id', name: 'author', component: () => import('../views/AuthorView.vue') },
    { path: '/videos/:id', name: 'video-detail', component: () => import('../views/VideoDetailView.vue') },
    { path: '/login', name: 'login', component: () => import('../views/LoginView.vue'), meta: { guestOnly: true } },
    { path: '/register', name: 'register', component: () => import('../views/RegisterView.vue'), meta: { guestOnly: true } },
    { path: '/publish', name: 'publish', component: () => import('../views/PublishView.vue'), meta: { requiresAuth: true } },
    { path: '/me', name: 'my-videos', component: () => import('../views/MyVideosView.vue'), meta: { requiresAuth: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && auth.isLoggedIn) {
    return { name: 'feed' }
  }
  return true
})

export default router
