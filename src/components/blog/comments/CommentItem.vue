<script setup lang="ts">
import type { Comment } from "@/utils/blog/comments";
import { displayName } from "@/utils/profile/display-name";
import CommentAvatar from "./CommentAvatar.vue";
defineProps<{
  comment: Comment;
  viewerId?: number;
  postAuthorId?: number | string;
  busy?: boolean;
}>();
defineEmits<{ reply: []; edit: []; remove: [] }>();
const date = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
</script>
<template>
  <article
    class="comment-item"
    :class="{ 'comment-item-reply': comment.parentId }"
    :aria-label="
      comment.deleted ? '삭제된 댓글' : `${displayName(comment.author)}의 댓글`
    "
  >
    <template v-if="!comment.deleted && comment.author">
      <header class="comment-item-header">
        <CommentAvatar :author="comment.author" />
        <div class="comment-identity">
          <strong>{{ displayName(comment.author) }}</strong
          ><span
            v-if="comment.author.id === postAuthorId"
            class="comment-author-badge"
            >글쓴이</span
          >
          <time
            :datetime="comment.updatedAt ?? comment.createdAt"
            :title="`작성: ${date.format(new Date(comment.createdAt))}`"
            >{{ date.format(new Date(comment.updatedAt ?? comment.createdAt))
            }}<span v-if="comment.updatedAt"> · 수정됨</span></time
          >
        </div>
        <div
          v-if="viewerId === comment.author.id"
          class="comment-owner-actions"
        >
          <button
            :disabled="busy"
            aria-label="댓글 수정"
            @click="$emit('edit')"
          >
            수정
          </button>
          <button
            :disabled="busy"
            aria-label="댓글 삭제"
            @click="$emit('remove')"
          >
            삭제
          </button>
        </div>
      </header>
      <p class="comment-text">{{ comment.content }}</p>
      <button
        v-if="viewerId !== undefined && !comment.parentId"
        class="comment-reply-action"
        :disabled="busy"
        @click="$emit('reply')"
      >
        답글 쓰기
      </button>
    </template>
    <p v-else class="comment-deleted">삭제된 댓글입니다.</p>
    <slot />
  </article>
</template>
<style scoped>
.comment-item {
  padding: 22px 0;
}
.comment-item-reply {
  margin-left: 24px;
  padding-left: 18px;
  border-left: 1px solid var(--theme-border);
}
.comment-item-header {
  display: flex;
  align-items: center;
  gap: 10px;
}
.comment-identity {
  min-width: 0;
  flex: 1;
}
.comment-identity strong {
  font-size: inherit;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.comment-identity time {
  display: block;
  margin-top: 3px;
  color: var(--theme-muted);
  font-size: 11px;
}
.comment-author-badge {
  margin-left: 6px;
  font-size: 10px;
  color: var(--theme-accent);
}
.comment-owner-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.comment-owner-actions button {
  display: grid;
  place-items: center;
  width: 36px;
  height: 32px;
  padding: 0;
  line-height: 16px;
  font-size: 11px;
  color: var(--theme-muted);
  border-radius: 5px;
}
.comment-owner-actions button:hover {
  color: var(--theme-text);
  background: var(--theme-raised);
}
.comment-item .comment-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: inherit;
  line-height: 1.8;
  margin: 14px 0 6px;
  color: var(--theme-text);
}
.comment-reply-action {
  padding: 5px 0;
  font-size: 11px;
  color: var(--theme-muted);
}
.comment-reply-action:hover {
  color: var(--theme-accent);
}
.comment-item .comment-deleted {
  font-size: inherit;
  color: var(--theme-muted);
  margin: 0;
}
.comment-item :deep(.comment-composer) {
  margin-top: 14px;
}
@media (max-width: 600px) {
  .comment-item-reply {
    margin-left: 12px;
    padding-left: 12px;
  }
}
</style>
