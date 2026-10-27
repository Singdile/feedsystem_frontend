<script setup lang="ts">
import { useRoute } from 'vue-router'
import NavBar from './components/NavBar.vue'

const route = useRoute()
const isFeed = () => route.name === 'feed'
</script>

<template>
  <NavBar :peek="isFeed()" />
  <main class="app-main" :class="{ 'is-feed': isFeed() }">
    <router-view />
  </main>
</template>

<style scoped>
.app-main {
  min-height: calc(100vh - var(--nav-h));
  min-height: calc(100dvh - var(--nav-h));
}

.app-main.is-feed {
  min-height: 0;
}
</style>
