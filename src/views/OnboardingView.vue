<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import AuthLayout from "@/layouts/AuthLayout.vue";
import Icon from "@/components/Icon.vue";
import { auth, AuthError } from "@/store/auth";
import { nicknameError } from "@/utils/auth/validation";
import { prepareAvatar } from "@/utils/profile/avatar-upload";
import { loginDestination } from "@/router/auth-guard";
const router = useRouter();
const route = useRoute();
const nickname = ref(auth.user.value?.nickname ?? "");
const nicknameInput = ref<HTMLInputElement>();
const fileInput = ref<HTMLInputElement>();
const photo = ref<File | null>(null);
const preview = ref("");
const photoError = ref("");
const processingPhoto = ref(false);
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
let photoVersion = 0;
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
function clearPhoto() {
  photoVersion++;
  if (preview.value) URL.revokeObjectURL(preview.value);
  preview.value = "";
  photo.value = null;
  photoError.value = "";
  processingPhoto.value = false;
  if (fileInput.value) fileInput.value.value = "";
}
async function selectPhoto(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const current = ++photoVersion;
  processingPhoto.value = true;
  photoError.value = "";
  try {
    const prepared = await prepareAvatar(file);
    if (current !== photoVersion) return;
    if (preview.value) URL.revokeObjectURL(preview.value);
    photo.value = prepared;
    preview.value = URL.createObjectURL(prepared);
  } catch (reason) {
    if (current === photoVersion)
      photoError.value =
        reason instanceof Error ? reason.message : "사진을 처리하지 못했어요.";
  } finally {
    if (current === photoVersion) processingPhoto.value = false;
    if (fileInput.value) fileInput.value.value = "";
  }
}
async function submit() {
  if (busy.value || processingPhoto.value) return;
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
    await auth.completeOnboarding(nickname.value.trim(), photo.value);
    await router.replace(loginDestination(route.query.redirect));
  } catch (reason) {
    if (reason instanceof AuthError && reason.code === "NICKNAME_TAKEN") {
      status.value = "taken";
      nicknameInput.value?.focus();
    } else
      error.value =
        reason instanceof Error
          ? reason.message
          : "프로필을 저장하지 못했어요. 다시 시도해 주세요.";
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
  clearPhoto();
});
</script>
<template>
  <AuthLayout onboarding>
    <span class="auth-eyebrow">NICE TO MEET YOU</span>
    <h1>어떤 이름으로<br />만나면 좋을까요<span>?</span></h1>
    <p class="auth-description">나를 표현하는 프로필을 완성해 주세요.</p>
    <form
      class="onboarding-form"
      novalidate
      :aria-busy="busy"
      @submit.prevent="submit"
    >
      <div class="onboarding-photo-row">
        <button
          type="button"
          class="onboarding-avatar"
          :disabled="busy || processingPhoto"
          aria-label="프로필 사진 선택"
          @click="fileInput?.click()"
        >
          <img v-if="preview" :src="preview" alt="선택한 프로필 사진" />
          <span v-else class="onboarding-avatar-letter">{{
            nickname.trim().slice(0, 1) || "d"
          }}</span>
          <span class="onboarding-camera"><Icon name="plus" :size="14" /></span>
        </button>
        <div>
          <span class="onboarding-photo-label"
            >프로필 사진 <small>선택</small></span
          >
          <div class="onboarding-photo-actions">
            <button
              type="button"
              :disabled="busy || processingPhoto"
              @click="fileInput?.click()"
            >
              {{
                processingPhoto
                  ? "사진 준비 중…"
                  : preview
                    ? "사진 변경"
                    : "사진 추가"
              }}</button
            ><button
              v-if="preview"
              type="button"
              :disabled="busy"
              @click="clearPhoto"
            >
              삭제
            </button>
          </div>
        </div>
        <input
          ref="fileInput"
          type="file"
          class="visually-hidden"
          accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
          aria-label="프로필 사진 파일"
          :disabled="busy || processingPhoto"
          @change="selectPhoto"
        />
      </div>
      <p v-if="photoError" class="auth-field-message is-invalid" role="alert">
        {{ photoError }}
      </p>
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
        :disabled="
          busy || processingPhoto || !nickname.trim() || status === 'taken'
        "
      >
        {{ busy ? "프로필 저장 중…" : "시작하기"
        }}<Icon v-if="!busy" name="arrow-right" :size="18" />
      </button>
    </form>
    <button class="auth-browse" :disabled="busy" @click="changeAccount">
      다른 계정으로 로그인
    </button>
  </AuthLayout>
</template>
