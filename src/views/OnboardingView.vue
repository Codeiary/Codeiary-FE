<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AuthLayout from "@/layouts/AuthLayout.vue";
import Icon from "@/components/Icon.vue";
import { auth, AuthError } from "@/store/auth";
import { nicknameError } from "@/utils/auth/validation";
import { loginDestination } from "@/router/auth-guard";
const router = useRouter();
const route = useRoute();
const nickname = ref(auth.user.value?.nickname ?? "");
const nicknameInput = ref<HTMLInputElement>();
const busy = ref(false);
const error = ref("");
const touched = ref(false);
const status = ref<"idle" | "checking" | "available" | "taken" | "error">(
  "idle",
);
const checkError = ref("");
const checkedNickname = ref("");
let timer: ReturnType<typeof setTimeout> | undefined;
let version = 0;
const formatError = computed(() =>
  touched.value ? nicknameError(nickname.value) : "",
);
const fieldMessage = computed(
  () =>
    formatError.value ||
    (status.value === "taken"
      ? "이미 사용 중인 닉네임이에요."
      : status.value === "available"
        ? "사용할 수 있는 닉네임이에요."
        : status.value === "checking"
          ? "닉네임을 확인하고 있어요…"
          : status.value === "error"
            ? checkError.value
            : "한글, 영문, 숫자, 밑줄로 2~20자"),
);
const invalid = computed(
  () =>
    !!formatError.value || status.value === "taken" || status.value === "error",
);
async function check() {
  clearTimeout(timer);
  const current = ++version;
  const value = nickname.value.trim();
  if (nicknameError(value)) {
    status.value = "idle";
    return false;
  }
  status.value = "checking";
  try {
    const result = await auth.checkNickname(value);
    if (current !== version) return false;
    checkedNickname.value = value;
    status.value = result.available ? "available" : "taken";
    return result.available;
  } catch (reason) {
    if (current === version) {
      status.value = "error";
      checkError.value =
        reason instanceof Error
          ? reason.message
          : "닉네임을 확인하지 못했어요.";
    }
    return false;
  }
}
watch(nickname, () => {
  version++;
  clearTimeout(timer);
  status.value = "idle";
  error.value = "";
  checkedNickname.value = "";
  if (!nicknameError(nickname.value)) timer = setTimeout(check, 350);
});
async function submit() {
  if (busy.value) return;
  touched.value = true;
  error.value = "";
  if (nicknameError(nickname.value)) {
    await nextTick();
    nicknameInput.value?.focus();
    return;
  }
  busy.value = true;
  try {
    if (
      !(
        status.value === "available" &&
        checkedNickname.value === nickname.value.trim()
      ) &&
      !(await check())
    ) {
      nicknameInput.value?.focus();
      return;
    }
    await auth.completeOnboarding(nickname.value.trim());
    await router.replace(loginDestination(route.query.redirect));
  } catch (reason) {
    if (reason instanceof AuthError && reason.code === "NICKNAME_TAKEN") {
      status.value = "taken";
      nicknameInput.value?.focus();
    } else
      error.value =
        reason instanceof Error
          ? reason.message
          : "닉네임을 저장하지 못했어요. 다시 시도해 주세요.";
  } finally {
    busy.value = false;
  }
}
async function changeAccount() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await auth.logout();
    await router.replace({
      name: "login",
      query: { redirect: route.query.redirect },
    });
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : "다시 시도해 주세요.";
  } finally {
    busy.value = false;
  }
}
onBeforeUnmount(() => {
  version++;
  clearTimeout(timer);
});
</script>
<template>
  <AuthLayout onboarding>
    <span class="auth-eyebrow">NICE TO MEET YOU</span>
    <h1>어떤 이름으로<br />만나면 좋을까요<span>?</span></h1>
    <p class="auth-description">동네에서 사용할 닉네임을 정해 주세요.</p>
    <form
      class="onboarding-form"
      novalidate
      :aria-busy="busy"
      @submit.prevent="submit"
    >
      <label for="onboarding-nickname" class="auth-field-label">닉네임</label>
      <div class="onboarding-input" :class="{ 'is-invalid': invalid }">
        <input
          id="onboarding-nickname"
          ref="nicknameInput"
          v-model="nickname"
          type="text"
          autocomplete="nickname"
          autocapitalize="off"
          :spellcheck="false"
          maxlength="20"
          placeholder="나만의 닉네임"
          :disabled="busy"
          :aria-invalid="invalid"
          aria-describedby="nickname-help"
          @blur="touched = true"
        /><Icon v-if="status === 'available'" name="check" :size="18" /><span
          v-else-if="status === 'checking'"
          class="auth-spinner small"
          aria-hidden="true"
        ></span>
      </div>
      <p
        id="nickname-help"
        class="auth-field-message"
        :class="{
          'is-invalid': invalid,
          'is-available': status === 'available',
        }"
        role="status"
      >
        {{ fieldMessage }}
        <button v-if="status === 'error'" type="button" @click="check">
          다시 확인
        </button>
      </p>
      <p v-if="error" class="auth-message" role="alert">{{ error }}</p>
      <button
        class="auth-primary"
        :disabled="busy || !nickname.trim() || status === 'taken'"
      >
        {{ busy ? "닉네임 저장 중…" : "시작하기"
        }}<Icon v-if="!busy" name="arrow-right" :size="18" />
      </button>
    </form>
    <button class="auth-browse" :disabled="busy" @click="changeAccount">
      다른 계정으로 로그인
    </button>
  </AuthLayout>
</template>
