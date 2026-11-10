<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import AuthLayout from "@/layouts/AuthLayout.vue";
import { auth } from "@/store/auth";
import { consumeOAuthAttempt, githubLinkUrl } from "@/utils/auth/oauth";
import { loginDestination } from "@/router/auth-guard";
const route = useRoute();
const router = useRouter();
const error = ref("");
const redirect = ref("/");
const repositoryFailed = ref(false);
function retryGitHub() {
  window.location.assign(githubLinkUrl());
}
onMounted(async () => {
  const { error: providerError } = route.query;
  // The server has already completed OAuth; only the app session is restored here.
  history.replaceState(history.state, "", "/auth/callback");
  try {
    redirect.value = consumeOAuthAttempt();
    if (providerError && providerError !== "github_repository")
      throw new Error("계정 인증이 취소되었거나 연결하지 못했어요. 다시 시도해 주세요.");
    await auth.completeOAuthLogin();
    if (providerError === "github_repository") {
      repositoryFailed.value = true;
      throw new Error("GitHub 저장소를 연결하지 못했어요. 앱 권한을 확인한 뒤 다시 시도해 주세요.");
    }
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
      <template v-if="repositoryFailed">
        <button type="button" class="auth-primary" @click="retryGitHub">GitHub 연결</button>
        <RouterLink to="/home">마이페이지로 돌아가기</RouterLink>
      </template>
      <RouterLink v-else
        class="auth-primary"
        :to="{ name: 'login', query: { redirect } }"
        >로그인으로 돌아가기</RouterLink
      ></template
    >
    <div v-else class="auth-connecting" role="status">
      <span class="auth-spinner"></span>
      <h1>곧 만나요<span>.</span></h1>
      <p class="auth-description">계정 인증 정보를 확인하고 있어요.</p>
    </div>
  </AuthLayout>
</template>
