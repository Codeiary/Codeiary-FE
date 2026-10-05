<script setup lang="ts">
import { computed, nextTick, reactive, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import BrandLogo from "../components/BrandLogo.vue";
import ThemeToggle from "../components/ThemeToggle.vue";
import Icon from "../components/Icon.vue";
import { auth, AuthError } from "../auth/session";
import { loginDestination } from "../auth/navigation";
import { emailError, passwordError } from "../auth/validation";

const route = useRoute();
const router = useRouter();
const email = ref("");
const password = ref("");
const visible = ref(false);
const busy = ref(false);
const submitted = ref(false);
const touched = reactive({ email: false, password: false });
const error = ref("");
const emailInput = ref<HTMLInputElement>();
const passwordInput = ref<HTMLInputElement>();
const errors = computed(() => ({
  email: touched.email || submitted.value ? emailError(email.value) : "",
  password:
    touched.password || submitted.value ? passwordError(password.value) : "",
}));
const sessionNotice = computed(
  () =>
    auth.notice.value ||
    (route.query.retry === "1"
      ? "인증 상태를 확인하지 못했어요. 잠시 후 다시 로그인해 주세요."
      : ""),
);

async function login() {
  if (busy.value) return;
  submitted.value = true;
  error.value = "";
  if (errors.value.email || errors.value.password) {
    await nextTick();
    (errors.value.email ? emailInput.value : passwordInput.value)?.focus();
    return;
  }
  busy.value = true;
  try {
    await auth.login(email.value, password.value);
    password.value = "";
    submitted.value = false;
    touched.password = false;
    await router.replace(loginDestination(route.query.redirect));
  } catch (reason) {
    error.value =
      reason instanceof AuthError
        ? reason.message
        : "로그인하지 못했어요. 다시 시도해 주세요.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="login-shell">
    <header class="login-header">
      <RouterLink to="/" class="brand" aria-label="Codeiary 홈으로"
        ><BrandLogo
      /></RouterLink>
      <div class="login-header-actions">
        <RouterLink to="/" class="login-home"
          >동네로 돌아가기 <Icon name="arrow" :size="14"
        /></RouterLink>
        <ThemeToggle />
      </div>
    </header>

    <main class="login-main">
      <section class="login-story" aria-label="Codeiary 개발 이야기">
        <div class="login-eyebrow">
          <span></span> A LITTLE SPACE FOR BIG IDEAS
        </div>
        <h1>Every day,<br />a new <em>page.</em></h1>
        <p class="login-story-copy">
          배우고, 만들고, 기록하는 나만의 작은 세계.
        </p>

        <div class="diary-art" aria-hidden="true">
          <div class="diary-orbit"></div>
          <span class="diary-spark diary-spark-one">✳</span>
          <span class="diary-spark diary-spark-two">+</span>
          <div class="diary-shadow"></div>
          <div class="diary-book">
            <div class="diary-book-edge"></div>
            <div class="diary-cover">
              <span class="diary-spine"></span>
              <span class="diary-ribbon"></span>
              <span class="diary-edition">NOTES TO MY FUTURE SELF</span>
              <span class="diary-monogram">d<span>.</span></span>
              <div class="diary-cover-bottom">
                <span>Code Diary</span><span>VOL. 01</span>
              </div>
            </div>
          </div>
          <div class="diary-note">
            <span>one day at a time.</span
            ><svg width="52" height="26" viewBox="0 0 52 26" fill="none">
              <path
                d="M2 5c15 20 39 18 46 1m-9 5 9-6 2 10"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
        </div>
        <div class="login-story-footer">
          <span>LEARN. BUILD. DOCUMENT.</span><span>EST. 2026</span>
        </div>
      </section>

      <section class="login-form-section" aria-labelledby="login-title">
        <div class="login-form-wrap">
          <span class="login-kicker">WELCOME BACK</span>
          <h2 id="login-title">이어서 써볼까요<span>?</span></h2>
          <p class="login-intro">오늘의 이야기가 기다리고 있어요.</p>
          <p
            v-if="route.query.signedOut === '1' && !error"
            class="login-notice login-success"
            role="status"
          >
            <Icon name="check" :size="16" /> 로그아웃되었어요. 다음 이야기에서
            만나요.
          </p>
          <p
            v-else-if="sessionNotice && !error"
            class="login-notice"
            role="status"
          >
            {{ sessionNotice }}
          </p>

          <form novalidate :aria-busy="busy" @submit.prevent="login">
            <div class="login-field">
              <label for="login-email">이메일</label>
              <div class="login-input-wrap" :class="{ invalid: errors.email }">
                <Icon name="mail" :size="18" />
                <input
                  id="login-email"
                  ref="emailInput"
                  v-model="email"
                  type="email"
                  name="email"
                  autocomplete="username"
                  inputmode="email"
                  autocapitalize="none"
                  :spellcheck="false"
                  placeholder="you@example.com"
                  :disabled="busy"
                  :aria-invalid="Boolean(errors.email)"
                  :aria-describedby="errors.email ? 'email-error' : undefined"
                  required
                  @blur="touched.email = true"
                  @input="error = ''"
                />
              </div>
              <p v-if="errors.email" id="email-error" class="login-field-error">
                {{ errors.email }}
              </p>
            </div>
            <div class="login-field">
              <label for="login-password">비밀번호</label>
              <div
                class="login-input-wrap"
                :class="{ invalid: errors.password }"
              >
                <Icon name="lock" :size="18" />
                <input
                  id="login-password"
                  ref="passwordInput"
                  v-model="password"
                  :type="visible ? 'text' : 'password'"
                  name="password"
                  autocomplete="current-password"
                  placeholder="비밀번호를 입력해 주세요"
                  :disabled="busy"
                  :aria-invalid="Boolean(errors.password)"
                  :aria-describedby="
                    errors.password ? 'password-error' : undefined
                  "
                  required
                  @blur="touched.password = true"
                  @input="error = ''"
                />
                <button
                  type="button"
                  class="password-visibility"
                  :aria-label="visible ? '비밀번호 숨기기' : '비밀번호 보기'"
                  :aria-pressed="visible"
                  @click="visible = !visible"
                >
                  <Icon :name="visible ? 'eye-off' : 'eye'" :size="18" />
                </button>
              </div>
              <p
                v-if="errors.password"
                id="password-error"
                class="login-field-error"
              >
                {{ errors.password }}
              </p>
            </div>
            <p v-if="error" class="login-notice login-error" role="alert">
              {{ error }}
            </p>
            <button type="submit" class="login-submit" :disabled="busy">
              <span>{{ busy ? "로그인하는 중이에요" : "로그인" }}</span>
              <span v-if="busy" class="login-spinner" aria-hidden="true"></span>
              <Icon v-else name="arrow-right" :size="19" />
            </button>
          </form>

          <div class="login-form-divider">
            <span></span><Icon name="book" :size="16" /><span></span>
          </div>
          <p class="login-browse-copy">잠깐 둘러보러 오셨나요?</p>
          <RouterLink to="/" class="login-browse"
            >로그인 없이 둘러보기 <Icon name="arrow" :size="13"
          /></RouterLink>
        </div>
      </section>
    </main>
    <footer class="login-footer">
      <span>© {{ new Date().getFullYear() }} Codeiary</span
      ><span>Small steps. Better code.</span>
    </footer>
  </div>
</template>

<style src="../login.css"></style>
