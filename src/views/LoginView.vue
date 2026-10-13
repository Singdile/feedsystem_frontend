<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  if (!username.value.trim() || !password.value) {
    error.value = '请输入用户名和密码'
    return
  }
  loading.value = true
  try {
    await auth.login(username.value.trim(), password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.push(redirect)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <form class="auth-card" @submit.prevent="onSubmit" novalidate>
      <h1 class="auth-title">登录</h1>
      <p class="auth-sub">继续你的时间线</p>

      <div v-if="error" class="alert alert-error" role="alert">{{ error }}</div>

      <div class="field">
        <label for="username">用户名</label>
        <input id="username" v-model="username" class="input" autocomplete="username" autofocus />
      </div>

      <div class="field">
        <label for="password">密码</label>
        <input id="password" v-model="password" class="input" type="password" autocomplete="current-password" />
      </div>

      <button class="btn btn-primary auth-submit" type="submit" :disabled="loading">
        <span v-if="loading" class="spinner" aria-hidden="true"></span>
        {{ loading ? '登录中…' : '登录' }}
      </button>

      <p class="auth-switch">
        还没有账号？
        <router-link to="/register">去注册</router-link>
      </p>
    </form>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: calc(100vh - var(--nav-h));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--sp-6);
  position: relative;
  overflow: hidden;
}

.auth-page::before {
  content: '';
  position: absolute;
  inset: -30%;
  background: var(--grad-mesh);
  opacity: 0.14;
  filter: blur(80px);
  pointer-events: none;
}

.auth-card {
  width: 100%;
  max-width: 400px;
  background: var(--surface);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-xl);
  padding: var(--sp-8);
  box-shadow: var(--shadow-lg);
  position: relative;
}

.auth-title {
  margin: 0;
  font-size: var(--font-size-2xl);
  line-height: var(--line-tight);
  background: var(--grad-brand);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.auth-sub {
  margin: var(--sp-1) 0 var(--sp-6);
  color: var(--text-3);
  font-size: var(--font-size-sm);
}

.auth-submit {
  width: 100%;
  margin-top: var(--sp-2);
}

.auth-switch {
  margin: var(--sp-5) 0 0;
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--text-3);
}

.auth-switch a {
  color: var(--accent);
  font-weight: 600;
}

.auth-switch a:hover {
  text-decoration: underline;
}
</style>
