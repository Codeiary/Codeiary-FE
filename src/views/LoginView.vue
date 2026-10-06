<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import AuthLayout from "@/layouts/AuthLayout.vue";
import GoogleMark from "@/components/GoogleMark.vue";
import { auth } from "@/store/auth";
import { googleLoginUrl } from "@/utils/auth/oauth";
const route = useRoute();
const busy = ref(false);
const error = ref("");
function login() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    window.location.assign(googleLoginUrl(route.query.redirect));
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : "로그인을 시작하지 못했어요.";
    busy.value = false;
  }
}
function reset() {
  busy.value = false;
}
onMounted(() => window.addEventListener("pageshow", reset));
onBeforeUnmount(() => window.removeEventListener("pageshow", reset));
</script>
<template>
  <AuthLayout>
    <span class="auth-eyebrow">CODE DIARY</span>
    <h1>당신의 다음 이야기를<br />시작해 보세요<span>.</span></h1>
    <p v-if="error" class="auth-message" role="alert">{{ error }}</p>
    <p
      v-else-if="route.query.signedOut === '1'"
      class="auth-message"
      role="status"
    >
      로그아웃되었어요.
    </p>
    <p v-else-if="auth.notice.value" class="auth-message" role="status">
      {{ auth.notice.value }}
    </p>
    <button class="google-signin" :disabled="busy" @click="login">
      <GoogleMark /><span>{{
        busy ? "연결하는 중…" : "Google로 계속하기"
      }}</span>
    </button>
    <RouterLink to="/" class="auth-browse"
      >로그인 없이 둘러보기 <span aria-hidden="true">↗</span></RouterLink
    >
  </AuthLayout>
</template>
