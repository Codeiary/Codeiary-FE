<script setup lang="ts">
import { ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import Icon from "@/components/Icon.vue";
import { updatePostLike } from "@/services/blog-api";
import type { PostLikeState } from "@/services/blog-api";
import { auth } from "@/store/auth";

const props = defineProps<{
  postId: number;
  likeCount: number;
  likedByMe: boolean;
  compact?: boolean;
}>();
const route = useRoute();
const router = useRouter();
const { user } = auth;
const emit = defineEmits<{ updated: [] }>();
const count = ref(props.likeCount);
const liked = ref(props.likedByMe);
const busy = ref(false);
const error = ref("");

watch(() => [props.postId, props.likeCount, props.likedByMe], () => {
  count.value = props.likeCount;
  liked.value = props.likedByMe;
});

async function toggle() {
  if (!user.value) {
    await router.push({ name: "login", query: { redirect: route.fullPath } });
    return;
  }
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    const result = await updatePostLike(props.postId, !liked.value);
    count.value = result.likeCount;
    liked.value = result.likedByMe;
    emit("updated");
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "좋아요를 반영하지 못했어요.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <span class="post-like-wrap" :class="{ 'post-like-compact': compact }">
    <button
      type="button"
      class="post-like-button"
      :class="{ liked }"
      :aria-pressed="liked"
      :aria-label="liked ? `좋아요 취소, 현재 ${count}개` : `좋아요, 현재 ${count}개`"
      :disabled="busy"
      @click="toggle"
    >
      <Icon name="heart" :size="15" />
      <span>{{ count.toLocaleString("ko-KR") }}</span>
    </button>
    <span v-if="error" class="post-like-error" role="status">{{ error }}</span>
  </span>
</template>

<style scoped>
.post-like-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--theme-muted);
  font-size: var(--font-size-min);
}
.post-like-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 42px;
  min-height: 32px;
  padding: 4px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  transition: color 140ms ease, background-color 140ms ease;
}
.post-like-button:hover:not(:disabled),
.post-like-button.liked {
  color: var(--theme-accent);
  background: color-mix(in srgb, var(--theme-accent) 9%, transparent);
}
.post-like-button.liked :deep(svg) {
  fill: currentColor;
}
.post-like-button:disabled {
  cursor: wait;
  opacity: .65;
}
.post-like-error {
  color: var(--theme-muted);
}
.post-like-compact .post-like-button {
  min-height: 28px;
  padding-inline: 4px;
}
</style>
