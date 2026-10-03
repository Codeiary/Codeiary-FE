<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <main class="page">
    <section class="welcome-card">
      <span class="eyebrow">VUE 3 · VITE</span>
      <h1>Codeiary 시작하기</h1>
      <p>Vue 개발 환경이 준비됐어요. 이제 멋진 서비스를 만들어 보세요.</p>
      <button type="button" @click="count++">클릭 {{ count }}</button>
    </section>
  </main>
</template>
