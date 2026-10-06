<script setup lang="ts">
import { ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { auth, AuthError } from "@/store/auth";
import Icon from "@/components/Icon.vue";

defineProps<{ compact?: boolean }>();

const route = useRoute();
const router = useRouter();
const error = ref("");
const { user, signingOut } = auth;

async function logout() {
  error.value = "";
  try {
    await auth.logout();
    await router.replace({ name: "login", query: { signedOut: "1" } });
  } catch (reason) {
    error.value =
      reason instanceof AuthError
        ? reason.message
        : "로그아웃하지 못했어요. 다시 시도해 주세요.";
  }
}
</script>

<template>
  <div class="account-actions">
    <template v-if="user">
      <RouterLink
        v-if="!compact && user.role === 'ADMIN' && route.name !== 'admin'"
        to="/admin"
        class="account-admin"
        >관리자</RouterLink
      >
      <span v-if="!compact" class="account-name" :title="user.name"
        >{{ user.name }}<span>님</span></span
      >
      <button class="account-button" :disabled="signingOut" @click="logout">
        {{ signingOut ? "로그아웃 중" : "로그아웃" }}
        <Icon name="logout" :size="15" />
      </button>
    </template>
    <RouterLink v-else to="/login" class="account-button account-login"
      >로그인 <Icon name="arrow" :size="14"
    /></RouterLink>
    <div v-if="error" class="account-error" role="alert">
      <span>{{ error }}</span>
      <button aria-label="오류 안내 닫기" @click="error = ''">
        <Icon name="close" :size="16" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.account-actions {
  display: flex;
  align-items: center;
  gap: 18px;
  position: relative;
  white-space: nowrap;
}
.account-actions a {
  text-decoration: none;
}
.account-name {
  font-size: var(--account-font-size, var(--font-size-min));
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--theme-text);
}
.account-name span {
  margin-left: 3px;
  color: var(--theme-muted);
}
.account-admin {
  font-size: var(--account-font-size, var(--font-size-min));
  color: var(--theme-muted);
}
.account-admin:hover {
  color: var(--theme-accent);
}
.account-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 38px;
  padding: 0 15px;
  border: 1px solid var(--theme-border);
  border-radius: 6px;
  color: var(--theme-text);
  background: var(--theme-surface);
  font-size: var(--account-font-size, var(--font-size-min));
  font-weight: 550;
  transition:
    border-color 0.2s,
    background 0.2s;
}
.account-button:hover {
  border-color: var(--theme-accent);
  background: var(--theme-raised);
}
.account-login {
  border-color: transparent;
  background: var(--theme-raised);
}
.account-button:disabled {
  opacity: 0.65;
  cursor: wait;
}
.account-error {
  position: absolute;
  top: calc(100% + 14px);
  right: 0;
  z-index: 50;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: min(300px, calc(100vw - 32px));
  padding: 16px;
  white-space: normal;
  background: var(--theme-surface);
  color: var(--theme-text);
  border: 1px solid var(--theme-accent);
  border-radius: 8px;
  box-shadow: 0 8px 30px #00000014;
  font-size: var(--account-font-size, var(--font-size-min));
  line-height: 1.7;
}
.account-error button {
  padding: 2px;
  display: flex;
}
@media (max-width: 1050px) {
  .account-name {
    display: none;
  }
  .account-actions {
    gap: 12px;
  }
}
@media (max-width: 600px) {
  .account-actions {
    gap: 10px;
  }
  .account-button {
    min-height: 36px;
    padding: 0 12px;
    font-size: var(--account-font-size, var(--font-size-min));
  }
  .account-admin {
    font-size: var(--account-font-size, var(--font-size-min));
  }
}
</style>
