<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import Icon from "@/components/Icon.vue";
import { disconnectGitHub, fetchGitHubConnection, type GitHubConnection } from "@/services/github-api";
import { githubLinkUrl } from "@/utils/auth/oauth";

const connecting = ref(false);
const loading = ref(true);
const disconnecting = ref(false);
const connection = ref<GitHubConnection | null>(null);
const error = ref("");
const linked = computed(() => Boolean(connection.value?.connected && connection.value.repository?.installationId));
const popupMaxHeight = ref("360px");
const popupAbove = ref(false);
function positionSettings(event: Event) {
  const details = event.currentTarget as HTMLDetailsElement;
  if (!details.open) return;
  const anchor = details.querySelector("summary")!.getBoundingClientRect();
  const below = window.innerHeight - anchor.bottom - 24;
  popupAbove.value = below < 220 && anchor.top > below;
  popupMaxHeight.value = `${Math.max(120, Math.min(440, popupAbove.value ? anchor.top - 24 : below))}px`;
}
onMounted(async () => {
  try { connection.value = await fetchGitHubConnection(); }
  catch { error.value = "연동 정보를 불러오지 못했어요."; }
  finally { loading.value = false; }
});
async function disconnect() {
  if (disconnecting.value) return;
  disconnecting.value = true;
  error.value = "";
  try {
    await disconnectGitHub();
    connection.value = { connected: false, login: null };
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "연동을 해제하지 못했어요.";
  } finally {
    disconnecting.value = false;
  }
}
function connect() {
  if (connecting.value) return;
  connecting.value = true;
  error.value = "";
  try {
    window.location.assign(githubLinkUrl());
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "GitHub에 연결하지 못했어요.";
    connecting.value = false;
  }
}
</script>

<template>
  <details class="github-connection" @toggle="positionSettings">
    <summary aria-label="GitHub 연동 설정" title="GitHub 연동">
      <Icon name="github" :size="22" />
    </summary>
    <div class="github-settings" :class="{ 'github-settings-above': popupAbove }" :style="{ maxHeight: popupMaxHeight }">
      <strong class="github-heading">GitHub 연동</strong>
      <p v-if="loading" class="github-description" role="status">확인 중…</p>
      <div v-else-if="linked && connection?.login" class="github-account">
        <a :href="`https://github.com/${encodeURIComponent(connection.login)}`" target="_blank" rel="noopener noreferrer">@{{ connection.login }}</a>
        <span>연동됨</span>
      </div>
      <p v-else-if="!loading && !linked" class="github-description">GitHub 계정을 연결해요.</p>
      <template v-if="linked && connection">
        <p v-if="connection.repository" class="github-repository">
          <a :href="`https://github.com/${encodeURIComponent(connection.repository.owner)}/${encodeURIComponent(connection.repository.name)}`" target="_blank" rel="noopener noreferrer">{{ connection.repository.owner }}/{{ connection.repository.name }}</a>
          <small>{{ connection.repository.branch }}</small>
        </p>
      </template>
      <button v-if="linked" type="button" class="github-disconnect" :disabled="disconnecting || connecting" @click="disconnect">
        {{ disconnecting ? "해제 중…" : "연동 해제" }}
      </button>
      <p v-if="error" class="github-error" role="alert">{{ error }}</p>
      <div v-if="!loading && !linked" class="github-footer">
        <button type="button" :disabled="connecting" @click="connect">
          <Icon name="github" :size="16" />{{ connecting ? "연결 중…" : "GitHub 연결" }}
        </button>
      </div>
    </div>
  </details>
</template>

<style scoped>
.github-connection { position: relative; flex-shrink: 0; }
summary { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 8px; color: var(--theme-muted); list-style: none; cursor: pointer; }
summary::-webkit-details-marker { display: none; }
summary:hover, details[open] summary { background: var(--theme-raised); color: var(--theme-text); }
summary:focus-visible { outline: 2px solid var(--theme-accent); outline-offset: 3px; }
.github-settings { position: absolute; z-index: 20; top: calc(100% + 8px); right: 0; width: min(300px, calc(100vw - 40px)); box-sizing: border-box; padding: 18px; border: 1px solid var(--theme-border); border-radius: 12px; background: var(--theme-surface); box-shadow: 0 8px 28px #00000012; }
.github-heading { font-size: 14px; }
.github-settings { overflow-y: auto; overscroll-behavior: contain; }
.github-settings-above { top: auto; bottom: calc(100% + 8px); }
.github-description { margin: 10px 0; font-size: 13px; line-height: 1.7; }
.github-footer { display: grid; gap: 12px; margin-top: 16px; }
.github-footer button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 36px; padding: 8px 12px; border: 1px solid var(--theme-border); border-radius: 8px; background: var(--theme-raised); color: var(--theme-muted); font-size: 13px; cursor: pointer; }
.github-footer button:disabled { opacity: .5; cursor: default; }
.github-error { font-size: 12px; line-height: 1.6; }
.github-account { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; font-size: 13px; }
.github-account a { color: var(--theme-text); text-decoration: none; overflow-wrap: anywhere; }
.github-account a:hover { text-decoration: underline; }
.github-account span { flex-shrink: 0; color: var(--theme-muted); font-size: 12px; }
.github-disconnect { margin-top: 14px; padding: 0; border: 0; background: transparent; color: var(--theme-muted); font-size: 12px; cursor: pointer; }
.github-disconnect:hover { color: var(--theme-text); text-decoration: underline; }
.github-disconnect:disabled { opacity: .5; cursor: default; }
.github-repository { display: grid; gap: 4px; margin: 12px 0 0; font-size: 12px; overflow-wrap: anywhere; }
.github-repository a { color: var(--theme-text); text-decoration: none; }
.github-repository small { color: var(--theme-muted); }
</style>
