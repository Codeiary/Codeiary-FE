<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Icon from "@/components/Icon.vue";
import { fetchGitHubPostSync, type GitHubPostSync } from "@/services/github-api";

const props = defineProps<{ postId: number }>();
const sync = ref<GitHubPostSync | null>(null);
const error = ref(false);
const indicator = computed(() => {
  if (error.value) return "GitHub 상태를 확인하지 못했어요";
  if (!sync.value?.connected) return "";
  if (!sync.value.status) return "";
  if (sync.value.status === "COMPLETED") return "GitHub 동기화 완료";
  if (sync.value.status === "FAILED") return "GitHub 동기화 실패";
  return "GitHub 동기화 중";
});
const icon = computed(() => {
  if (error.value) return "help";
  if (sync.value?.status === "COMPLETED") return "check";
  if (sync.value?.status === "FAILED") return "close";
  return "clock";
});

watch(() => props.postId, (postId, _previous, onCleanup) => {
  let active = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  sync.value = null;
  error.value = false;
  async function refresh() {
    try {
      const result = await fetchGitHubPostSync(postId);
      if (!active) return;
      sync.value = result;
      error.value = false;
      if (result.connected && result.status && !["COMPLETED", "FAILED"].includes(result.status)) {
        timer = setTimeout(refresh, 3000);
      }
    } catch {
      if (active) error.value = true;
    }
  }
  void refresh();
  onCleanup(() => { active = false; clearTimeout(timer); });
}, { immediate: true });
</script>

<template>
  <span v-if="indicator" class="github-post-sync" :class="{ 'github-post-sync-failed': sync?.status === 'FAILED' }" role="status" :aria-label="indicator" :title="indicator">
    <Icon name="github" :size="15" /><Icon :name="icon" :size="15" />
  </span>
</template>

<style scoped>
.github-post-sync { display: inline-flex; align-items: center; gap: 4px; color: var(--theme-muted); }
.github-post-sync-failed { color: var(--theme-accent); }
</style>
