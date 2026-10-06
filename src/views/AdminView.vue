<script setup lang="ts">
import { RouterLink } from "vue-router";
import Icon from "@/components/Icon.vue";
import BrandLogo from "@/components/BrandLogo.vue";
import ThemeToggle from "@/components/ThemeToggle.vue";
import AccountActions from "@/components/AccountActions.vue";
</script>

<template>
  <main class="admin-shell">
    <header class="admin-header">
      <RouterLink to="/" class="brand" aria-label="Codeiary 홈으로">
        <BrandLogo />
      </RouterLink>
      <span class="admin-header-label">ADMIN STUDIO</span>
      <div class="admin-account">
        <ThemeToggle />
        <AccountActions />
      </div>
    </header>
    <div class="admin-content">
      <section class="admin-placeholder" aria-labelledby="admin-title">
        <h1 id="admin-title">관리자</h1>
        <p>관리자 기능은 준비 중입니다.</p>
        <RouterLink to="/" class="admin-return">
          메인 페이지로 돌아가기 <Icon name="arrow" :size="15" />
        </RouterLink>
      </section>
    </div>
  </main>
</template>
