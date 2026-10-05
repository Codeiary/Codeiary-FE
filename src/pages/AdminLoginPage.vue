<script setup lang="ts">
import { ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import Icon from "../components/Icon.vue";
import BrandLogo from "../components/BrandLogo.vue";
import ThemeToggle from "../components/ThemeToggle.vue";
import { signInDemoAdmin } from "../auth/admin";

const router = useRouter();
const busy = ref(false);
const error = ref("");
async function enterPreview() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await signInDemoAdmin();
    await router.replace({ name: "admin" });
  } catch {
    error.value = "관리자 미리보기를 열지 못했어요. 다시 시도해 주세요.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="admin-shell admin-entry">
    <RouterLink to="/" class="brand admin-brand" aria-label="Codeiary 홈으로">
      <BrandLogo />
    </RouterLink>
    <ThemeToggle class="admin-entry-theme" />
    <section class="admin-entry-card" aria-labelledby="admin-entry-title">
      <span class="admin-kicker">BEHIND THE STORIES</span>
      <div class="admin-entry-art" aria-hidden="true">
        <span>{</span><i>✳</i><span>}</span>
      </div>
      <h1 id="admin-entry-title">
        A little space<br />for <em>big ideas.</em>
      </h1>
      <p>이야기가 시작되는 곳.<br />관리자 화면을 미리 둘러보세요.</p>
      <span class="admin-demo-badge">목업 인증 · 새로고침하면 초기화돼요</span>
      <button class="admin-primary" :disabled="busy" @click="enterPreview">
        {{ busy ? "열고 있어요…" : "데모 관리자 입장"
        }}<Icon name="arrow" :size="18" />
      </button>
      <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
      <RouterLink to="/" class="admin-back">← 동네로 돌아가기</RouterLink>
    </section>
    <span class="admin-entry-footnote">LEARN. BUILD. WRITE. REPEAT.</span>
  </main>
</template>
