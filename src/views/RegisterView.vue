<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

const username = ref('')
const password = ref('')
const confirm = ref('')
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  if (!username.value.trim()) {
    error.value = '请输入用户名'
    return
  }
  if (username.value.trim().length < 3) {
    error.value = '用户名至少 3 个字符'
    return
  }
  if (!password.value) {
    error.value = '请输入密码'
    return
  }
  if (password.value.length < 6) {
    error.value = '密码至少 6 位'
    return
  }
  if (password.value !== confirm.value) {
    error.value = '两次输入的密码不一致'
    return
  }
  loading.value = true
  try {
    await auth.register(username.value.trim(), password.value)
    router.push({ name: 'feed' })
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
      <h1 class="auth-title">注册</h1>
      <p class="auth-sub">创建账号，发布你的第一条视频</p>

      <div v-if="error" class="alert alert-error" role="alert">{{ error }}</div>

      <div class="field">
        <label for="username">用户名</label>
        <input id="username" v-model="username" class="input" autocomplete="username" autofocus />
      </div>

      <div class="field">
        <label for="password">密码</label>
        <input id="password" v-model="password" class="input" type="password" autocomplete="new-password" />
      </div>

      <div class="field">
        <label for="confirm">确认密码</label>
        <input id="confirm" v-model="confirm" class="input" type="password" autocomplete="new-password" />
      </div>

      <button class="btn btn-primary auth-submit" type="submit" :disabled="loading">
        <span v-if="loading" class="spinner" aria-hidden="true"></span>
        {{ loading ? '注册中…' : '注册' }}
      </button>

      <p class="auth-switch">
        已有账号？
        <router-link to="/login">去登录</router-link>
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
