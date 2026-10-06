<script setup lang="ts">
import Icon from "./Icon.vue";
import EditorIcon from "../blog/EditorIcon.vue";

defineProps<{
  action?: "write" | "edit" | "blog";
  deletable?: boolean;
}>();
defineEmits<{ action: [value: "write" | "edit" | "blog" | "delete"] }>();
const labels = {
  write: { text: "글쓰기", accessible: "글쓰기" },
  edit: { text: "수정", accessible: "게시글 수정" },
  blog: { text: "내 블로그", accessible: "내 블로그 보기" },
};
</script>

<template>
  <div v-if="action || deletable" class="content-actions">
    <button
      v-if="action"
      :class="[
        action === 'write' ? 'blog-write-button' : 'blog-my-posts',
      ]"
      :aria-label="labels[action].accessible"
      @click="$emit('action', action)"
    >
      <Icon v-if="action === 'blog'" name="book" :size="15" />
      <EditorIcon v-else name="pen" />
      <span>{{ labels[action].text }}</span>
    </button>
    <button
      v-if="deletable"
      class="blog-delete-button"
      aria-label="게시글 삭제"
      @click="$emit('action', 'delete')"
    >
      <Icon name="trash" :size="15" />
      <span>삭제</span>
    </button>
  </div>
</template>
