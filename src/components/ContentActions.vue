<script setup lang="ts">
import Icon from "@/components/Icon.vue";
import EditorIcon from "@/components/blog/EditorIcon.vue";

withDefaults(defineProps<{
  action?: "write" | "edit";
  deletable?: boolean;
  subject?: "게시글" | "포트폴리오";
}>(), { subject: "게시글" });
defineEmits<{ action: [value: "write" | "edit" | "delete"] }>();
const labels = {
  write: { text: "글쓰기", accessible: "글쓰기" },
  edit: { text: "수정", accessible: "게시글 수정" },
};
</script>

<template>
  <div v-if="action || deletable" class="content-actions" :class="{ 'article-owner-actions': action === 'edit' }">
    <button
      v-if="action"
      :class="action === 'edit' ? 'content-action-edit' : 'blog-write-button'"
      :aria-label="action === 'edit' ? `${subject} 수정` : labels[action].accessible"
      @click="$emit('action', action)"
    >
      <EditorIcon name="pen" />
      <span>{{ labels[action].text }}</span>
    </button>
    <button
      v-if="deletable"
      class="blog-delete-button"
      :aria-label="`${subject} 삭제`"
      @click="$emit('action', 'delete')"
    >
      <Icon name="trash" :size="15" />
      <span>삭제</span>
    </button>
  </div>
</template>
