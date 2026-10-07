<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import AuthLayout from "@/layouts/AuthLayout.vue";
import { auth } from "@/store/auth";
import { consumeOAuthAttempt, oauthMockEnabled } from "@/utils/auth/oauth";
import { loginDestination } from "@/router/auth-guard";
const route = useRoute();
const router = useRouter();
const error = ref("");
const redirect = ref("/");
onMounted(async () => {
  const { preview, error: providerError } = route.query;
  // The server has already completed OAuth; only the app session is restored here.
  history.replaceState(history.state, "", "/auth/callback");
  try {
    redirect.value = consumeOAuthAttempt();
    if (providerError)
      throw new Error("Google 로그인이 취소되었어요. 다시 시도해 주세요.");
    if (import.meta.env.DEV && oauthMockEnabled && preview === "1") {
      const { startMockOAuthSession } = await import("@/services/mock-oauth");
      startMockOAuthSession();
    }
    await auth.completeOAuthLogin();
    await router.replace(
      auth.needsOnboarding.value
        ? { name: "onboarding", query: { redirect: redirect.value } }
        : loginDestination(redirect.value),
    );
  } catch (reason) {
    error.value =
      reason instanceof Error
        ? reason.message
        : "로그인에 실패했어요. 다시 시도해 주세요.";
  }
});
</script>
<template>
  <AuthLayout>
    <template v-if="error"
      ><h1>다시 연결해 볼까요<span>?</span></h1>
      <p class="auth-description" role="alert">{{ error }}</p>
      <RouterLink
        class="auth-primary"
        :to="{ name: 'login', query: { redirect } }"
        >로그인으로 돌아가기</RouterLink
      ></template
    >
    <div v-else class="auth-connecting" role="status">
      <span class="auth-spinner"></span>
      <h1>곧 만나요<span>.</span></h1>
      <p class="auth-description">Google 로그인 정보를 확인하고 있어요.</p>
    </div>
  </AuthLayout>
</template>
