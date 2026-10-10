<script setup lang="ts">
import { ref, watch } from "vue";
import type { CommentAuthor } from "@/utils/blog/comments";
import { displayName } from "@/utils/profile/display-name";
const props = defineProps<{ author: CommentAuthor }>();
const failed = ref(false);
watch(
  () => props.author.profileImageUrl,
  () => {
    failed.value = false;
  },
);
</script>
<template>
  <span class="comment-avatar" aria-hidden="true">
    <img
      v-if="author.profileImageUrl && !failed"
      :src="author.profileImageUrl"
      alt=""
      loading="lazy"
      referrerpolicy="no-referrer"
      @error="failed = true"
    />
    <span v-else>{{ Array.from(displayName(author))[0] }}</span>
  </span>
</template>
<style scoped>
.comment-avatar {
  width: 34px;
  height: 34px;
  flex: 0 0 34px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--theme-raised);
  color: var(--theme-muted);
  font-size: var(--font-size-min);
  overflow: hidden;
}
.comment-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
