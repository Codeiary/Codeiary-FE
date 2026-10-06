<script setup lang="ts">
import { RouterLink } from "vue-router";
import BrandLogo from "@/components/BrandLogo.vue";
import ThemeToggle from "@/components/ThemeToggle.vue";
import Icon from "@/components/Icon.vue";
import "@/assets/styles/login.css";
defineProps<{ onboarding?: boolean }>();
</script>
<template>
  <div class="auth-shell">
    <header class="auth-header">
      <RouterLink to="/" class="brand" aria-label="Codeiary 홈으로"
        ><BrandLogo
      /></RouterLink>
      <div class="auth-header-actions">
        <ThemeToggle /><RouterLink
          v-if="!onboarding"
          to="/"
          class="auth-close"
          aria-label="로그인 창 닫기"
          ><Icon name="close" :size="20"
        /></RouterLink>
      </div>
    </header>
    <main class="auth-main">
      <aside class="auth-story" aria-hidden="true">
        <div class="auth-paper">
          <span class="auth-ribbon"></span
          ><span class="auth-paper-number">a little, every day.</span
          ><span class="auth-paper-letter">d<span>.</span></span
          ><span class="auth-paper-title">Code Diary</span
          ><span class="auth-paper-line"></span>
        </div>
        <p>Your next<br /><em>chapter.</em></p>
      </aside>
      <section class="auth-content">
        <div class="auth-content-inner"><slot /></div>
      </section>
    </main>
  </div>
</template>
