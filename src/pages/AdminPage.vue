<script setup lang="ts">
import { ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import Icon from "../components/Icon.vue";
import BrandLogo from "../components/BrandLogo.vue";
import ThemeToggle from "../components/ThemeToggle.vue";
import { adminUser, signOutAdmin } from "../auth/admin";

const router = useRouter();
const busy = ref(false),
  error = ref("");
async function logout() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await signOutAdmin();
    await router.replace({ name: "admin-login" });
  } catch {
    error.value = "로그아웃하지 못했어요. 다시 시도해 주세요.";
  } finally {
    busy.value = false;
  }
}
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
        <span>{{ adminUser?.name }}</span
        ><button :disabled="busy" @click="logout">
          로그아웃 <Icon name="arrow" :size="14" />
        </button>
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
      <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
    </div>
  </main>
</template>
