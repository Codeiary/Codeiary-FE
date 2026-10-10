<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from "vue";
import { auth, AuthError, type ProfileUpdateInput, type UserProfile } from "@/store/auth";
import { nicknameError } from "@/utils/auth/validation";
import { prepareAvatar } from "@/utils/profile/avatar-upload";

const props = defineProps<{ user: UserProfile }>();
const emit = defineEmits<{ saved: []; cancel: [] }>();
const form = ref<HTMLFormElement>();
const nicknameInput = ref<HTMLInputElement>();
const photoInput = ref<HTMLInputElement>();
const saving = ref(false);
const processingPhoto = ref(false);
const error = ref("");
const photoError = ref("");
const invalidField = ref("");
const draft = reactive({
  nickname: props.user.nickname ?? "",
  githubUrl: props.user.githubUrl ?? "",
  contactEmail: props.user.contactEmail ?? "",
});
const profileImageUrl = ref(props.user.profileImageUrl ?? null);
const photoPreview = ref(profileImageUrl.value);
const photoFile = shallowRef<File | null>(null);
const imageFailed = ref(false);
const nicknameStatus = ref<"idle" | "current" | "checking" | "available" | "taken" | "error" | "invalid">("idle");
const checkedNickname = ref("");
const checkError = ref("");
let nicknameTimer: ReturnType<typeof setTimeout> | undefined;
let nicknameVersion = 0;
let photoVersion = 0;
let objectUrl: string | undefined;
let disposed = false;
const nicknameInvalid = computed(() => ["taken", "error", "invalid"].includes(nicknameStatus.value));
const nicknameMessage = computed(() => {
  switch (nicknameStatus.value) {
    case "current": return "현재 닉네임이에요.";
    case "checking": return "닉네임을 확인하고 있어요…";
    case "available": return "사용할 수 있는 닉네임이에요.";
    case "taken": return "이미 사용 중인 닉네임이에요.";
    case "error": return checkError.value;
    case "invalid": return nicknameError(draft.nickname);
    default: return "한글, 영문, 숫자, 밑줄로 2~20자";
  }
});

onMounted(() => nicknameInput.value?.focus());
onBeforeUnmount(() => {
  disposed = true;
  nicknameVersion++;
  photoVersion++;
  clearTimeout(nicknameTimer);
  releasePhoto();
});

function focusField(field: string) {
  nextTick(() => {
    const input = form.value?.elements.namedItem(field);
    if (input instanceof HTMLInputElement) input.focus();
  });
}
function fail(field: string, message: string) {
  invalidField.value = field;
  error.value = message;
  focusField(field);
}
function isCurrentNickname(value: string) {
  return !!props.user.nickname && value.toLowerCase() === props.user.nickname.trim().toLowerCase();
}
async function checkNickname() {
  clearTimeout(nicknameTimer);
  const version = ++nicknameVersion;
  const value = draft.nickname.trim();
  if (nicknameError(value)) {
    nicknameStatus.value = "invalid";
    return false;
  }
  if (isCurrentNickname(value)) {
    nicknameStatus.value = "current";
    checkedNickname.value = value;
    return true;
  }
  nicknameStatus.value = "checking";
  checkError.value = "";
  try {
    const result = await auth.checkNickname(value);
    if (disposed || version !== nicknameVersion) return false;
    checkedNickname.value = value;
    nicknameStatus.value = result.available ? "available" : "taken";
    return result.available;
  } catch (reason) {
    if (!disposed && version === nicknameVersion) {
      nicknameStatus.value = "error";
      checkError.value = reason instanceof Error ? reason.message : "닉네임을 확인하지 못했어요.";
    }
    return false;
  }
}
watch(() => draft.nickname, () => {
  nicknameVersion++;
  clearTimeout(nicknameTimer);
  checkedNickname.value = "";
  checkError.value = "";
  error.value = "";
  const value = draft.nickname.trim();
  if (!value) nicknameStatus.value = "idle";
  else if (nicknameError(value)) nicknameStatus.value = "invalid";
  else if (isCurrentNickname(value)) {
    nicknameStatus.value = "current";
    checkedNickname.value = value;
  } else {
    nicknameStatus.value = "checking";
    nicknameTimer = setTimeout(checkNickname, 350);
  }
}, { immediate: true });

function releasePhoto() {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = undefined;
}
async function selectPhoto(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file || saving.value) return;
  const version = ++photoVersion;
  processingPhoto.value = true;
  photoError.value = "";
  try {
    const prepared = await prepareAvatar(file);
    if (disposed || version !== photoVersion) return;
    releasePhoto();
    objectUrl = URL.createObjectURL(prepared);
    photoPreview.value = objectUrl;
    photoFile.value = prepared;
    imageFailed.value = false;
  } catch (reason) {
    if (!disposed && version === photoVersion) {
      photoError.value = reason instanceof Error ? reason.message : "사진을 처리하지 못했어요. 다시 선택해 주세요.";
    }
  } finally {
    if (!disposed && version === photoVersion) processingPhoto.value = false;
  }
}
function removePhoto() {
  photoVersion++;
  releasePhoto();
  photoFile.value = null;
  profileImageUrl.value = null;
  photoPreview.value = null;
  photoError.value = "";
  imageFailed.value = false;
  processingPhoto.value = false;
}

async function save() {
  if (saving.value || processingPhoto.value) return;
  if (auth.user.value?.id !== props.user.id || auth.user.value?.role === "PENDING") {
    emit("cancel");
    return;
  }
  error.value = "";
  invalidField.value = "";
  const input: ProfileUpdateInput = {
    nickname: draft.nickname.trim(),
    profileImageUrl: profileImageUrl.value,
    githubUrl: draft.githubUrl.trim() || null,
    contactEmail: draft.contactEmail.trim() || null,
  };
  const nicknameMessage = nicknameError(input.nickname);
  if (nicknameMessage) {
    nicknameStatus.value = "invalid";
    focusField("nickname");
    return;
  }
  if (nicknameStatus.value === "taken" || nicknameStatus.value === "error") {
    focusField("nickname");
    return;
  }
  if (input.githubUrl && !/^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\/?$/.test(input.githubUrl)) {
    return fail("githubUrl", "GitHub 프로필 주소를 입력해 주세요.");
  }
  if (input.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.contactEmail)) {
    return fail("contactEmail", "공개할 이메일 주소를 확인해 주세요.");
  }
  saving.value = true;
  try {
    if (!isCurrentNickname(input.nickname)
        && !(nicknameStatus.value === "available" && checkedNickname.value === input.nickname)
        && !(await checkNickname())) {
      focusField("nickname");
      return;
    }
    if (disposed) return;
    if (photoFile.value) {
      const uploaded = await auth.uploadProfileImage(photoFile.value);
      if (disposed) return;
      profileImageUrl.value = uploaded.profileImageUrl;
      photoFile.value = null;
    }
    input.profileImageUrl = profileImageUrl.value;
    await auth.updateProfile(input);
    if (!disposed) emit("saved");
  } catch (reason) {
    if (disposed) return;
    const message = reason instanceof Error ? reason.message : "프로필을 저장하지 못했어요. 다시 시도해 주세요.";
    if (reason instanceof AuthError && reason.code === "NICKNAME_TAKEN") {
      nicknameStatus.value = "taken";
      checkedNickname.value = input.nickname;
      focusField("nickname");
    } else {
      error.value = message;
    }
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <form
    id="home-profile-editor"
    ref="form"
    class="profile-editor"
    aria-labelledby="profile-editor-title"
    :aria-busy="saving || processingPhoto"
    novalidate
    @submit.prevent="save"
  >
    <h4 id="profile-editor-title">프로필 수정</h4>
    <div class="profile-photo">
      <div class="profile-photo-preview" aria-hidden="true">
        <img
          v-if="photoPreview && !imageFailed"
          :src="photoPreview"
          alt=""
          referrerpolicy="no-referrer"
          @error="imageFailed = true"
        />
        <span v-else>{{ draft.nickname.trim().slice(0, 1) || "d" }}</span>
      </div>
      <div class="profile-photo-copy">
        <span>프로필 사진 <small>선택</small></span>
        <div class="profile-photo-actions">
          <button type="button" :disabled="saving || processingPhoto" @click="photoInput?.click()">
            {{ photoPreview ? "사진 변경" : "사진 선택" }}
          </button>
          <button v-if="photoPreview" type="button" class="profile-photo-remove" :disabled="saving || processingPhoto" @click="removePhoto">
            삭제
          </button>
        </div>
        <p v-if="processingPhoto" class="profile-photo-progress" role="status">사진을 준비하고 있어요…</p>
      </div>
      <input
        id="profile-photo"
        ref="photoInput"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.avif,.heic,.heif"
        :disabled="saving || processingPhoto"
        hidden
        @change="selectPhoto"
      />
    </div>
    <p v-if="photoError" class="profile-error profile-photo-error" role="alert">{{ photoError }}</p>
    <fieldset :disabled="saving">
      <div class="profile-nickname-field">
        <label for="profile-nickname">
          <span>닉네임</span>
          <input
            id="profile-nickname"
            ref="nicknameInput"
            v-model="draft.nickname"
            name="nickname"
            autocomplete="nickname"
            maxlength="20"
            required
            :aria-invalid="nicknameInvalid"
            aria-describedby="profile-nickname-help"
          />
        </label>
        <p
          id="profile-nickname-help"
          class="profile-nickname-help"
          :class="{ 'is-available': nicknameStatus === 'available', 'is-invalid': nicknameInvalid }"
          :role="nicknameInvalid ? 'alert' : 'status'"
          aria-live="polite"
        >
          {{ nicknameMessage }}
          <button v-if="nicknameStatus === 'error'" type="button" @click="checkNickname">다시 확인</button>
        </p>
      </div>
      <label for="profile-github-url">
        <span>GitHub <small>선택</small></span>
        <input
          id="profile-github-url"
          v-model="draft.githubUrl"
          name="githubUrl"
          type="url"
          inputmode="url"
          autocomplete="off"
          placeholder="https://github.com/username"
          maxlength="255"
          :aria-invalid="invalidField === 'githubUrl'"
          :aria-describedby="invalidField === 'githubUrl' ? 'profile-edit-error' : undefined"
        />
      </label>
      <label for="profile-contact-email">
        <span>공개 이메일 <small>선택</small></span>
        <input
          id="profile-contact-email"
          v-model="draft.contactEmail"
          name="contactEmail"
          type="email"
          inputmode="email"
          autocomplete="off"
          placeholder="hello@example.com"
          maxlength="254"
          :aria-invalid="invalidField === 'contactEmail'"
          :aria-describedby="invalidField === 'contactEmail' ? 'profile-edit-error' : undefined"
        />
      </label>
    </fieldset>
    <p v-if="error" id="profile-edit-error" class="profile-error" role="alert">{{ error }}</p>
    <div class="profile-actions">
      <button type="button" class="profile-cancel" :disabled="saving" @click="emit('cancel')">취소</button>
      <button type="submit" class="profile-save" :disabled="saving || processingPhoto || nicknameStatus === 'taken' || nicknameStatus === 'error'">{{ saving ? "저장 중…" : "저장" }}</button>
    </div>
  </form>
</template>

<style scoped>
.profile-editor {
  margin-bottom: 24px;
  padding: 24px;
  border: 1px solid var(--theme-border);
  border-radius: 16px;
  background: var(--theme-raised);
  color: var(--theme-text);
}
.profile-editor h4 {
  margin: 0 0 22px;
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.4px;
}
.profile-photo {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.profile-photo-preview {
  display: grid;
  place-items: center;
  flex: 0 0 72px;
  height: 72px;
  overflow: hidden;
  border: 1px solid var(--theme-border);
  border-radius: 22px;
  background: var(--theme-surface);
  font-size: 26px;
  font-weight: 600;
}
.profile-photo-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.profile-photo-copy {
  min-width: 0;
  font-size: var(--font-size-min, 14px);
}
.profile-photo-copy small {
  margin-left: 6px;
}
.profile-photo-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 9px;
}
.profile-photo-actions button {
  min-height: 36px;
  padding: 7px 12px;
  border: 1px solid var(--theme-border);
  border-radius: 8px;
  background: var(--theme-surface);
  color: var(--theme-text);
  font-size: inherit;
}
.profile-photo-actions .profile-photo-remove {
  border-color: transparent;
  background: transparent;
  color: var(--theme-muted);
}
.profile-photo-progress {
  margin: 9px 0 0;
  color: var(--theme-muted);
  line-height: 1.5;
}
.profile-error.profile-photo-error {
  margin: -8px 0 20px;
}
.profile-editor fieldset {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.profile-editor label {
  display: grid;
  gap: 9px;
  min-width: 0;
  font-size: var(--font-size-min, 14px);
}
.profile-nickname-field {
  grid-column: 1 / -1;
}
.profile-nickname-help {
  min-height: 22px;
  margin: 8px 0 0;
  color: var(--theme-muted);
  font-size: var(--font-size-min, 14px);
  line-height: 1.5;
}
.profile-nickname-help.is-available {
  color: var(--theme-accent);
}
.profile-nickname-help.is-invalid {
  color: var(--theme-text);
}
.profile-nickname-help button {
  margin-left: 8px;
  color: var(--theme-accent);
  font-size: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
}
.profile-editor label > span {
  display: flex;
  align-items: baseline;
  gap: 7px;
}
.profile-editor small {
  color: var(--theme-muted);
  font-size: inherit;
}
.profile-editor input {
  width: 100%;
  min-width: 0;
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--theme-border);
  border-radius: 9px;
  background: var(--theme-surface);
  color: var(--theme-text);
  font: inherit;
  font-size: 16px;
}
.profile-editor input::placeholder {
  color: var(--theme-muted);
}
.profile-editor input:focus-visible,
.profile-editor button:focus-visible {
  outline: 2px solid var(--theme-accent);
  outline-offset: 2px;
}
.profile-editor input[aria-invalid="true"] {
  border-color: var(--theme-accent);
}
.profile-error {
  margin: 16px 0 0;
  font-size: var(--font-size-min, 14px);
  line-height: 1.6;
}
.profile-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 24px;
}
.profile-actions button {
  min-height: 40px;
  padding: 10px 18px;
  border-radius: 9px;
  font-size: var(--font-size-min, 14px);
}
.profile-cancel {
  color: var(--theme-muted);
}
.profile-save {
  background: var(--theme-accent);
  color: var(--theme-surface);
  font-weight: 650;
}
.profile-editor button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.profile-editor[aria-busy="true"] button:disabled {
  cursor: wait;
}
@media (max-width: 760px) {
  .profile-editor {
    padding: 20px 16px;
  }
  .profile-editor fieldset {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
}
</style>
