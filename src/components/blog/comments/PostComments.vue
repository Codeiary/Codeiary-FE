<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { auth } from "@/store/auth";
import { useComments } from "@/composables/useComments";
import { commentPostKey, type BlogComment } from "@/utils/blog/comments";
import type { BlogPost } from "@/utils/blog/posts";
import CommentComposer from "./CommentComposer.vue";
import CommentItem from "./CommentItem.vue";

const props = defineProps<{ post: Pick<BlogPost, "id" | "author"> }>();
const route = useRoute();
const { user } = auth;
const postKey = computed(() => commentPostKey(props.post));
const {
  threads,
  count,
  loading,
  busy,
  error,
  loadError,
  reload,
  add,
  edit,
  remove,
} = useComments(postKey);
const action = ref<{
  kind: "reply" | "edit" | "delete";
  comment: BlogComment;
} | null>(null);
const composerVersion = ref(0);
const announcement = ref("");
watch([postKey, () => user.value?.id], () => {
  action.value = null;
  composerVersion.value++;
  error.value = "";
  announcement.value = "";
});
function begin(kind: "reply" | "edit" | "delete", comment: BlogComment) {
  error.value = "";
  action.value = { kind, comment };
}
async function submitRoot(content: string) {
  const actor = user.value?.id;
  const key = postKey.value;
  if (
    (await add(content)) &&
    actor === user.value?.id &&
    key === postKey.value
  ) {
    composerVersion.value++;
    announcement.value = "댓글을 등록했어요.";
  }
}
async function submitAction(content?: string) {
  const current = action.value;
  if (!current) return;
  const success =
    current.kind === "delete"
      ? await remove(current.comment.id)
      : current.kind === "edit"
        ? await edit(current.comment.id, content ?? "")
        : await add(content ?? "", current.comment.id);
  if (success && action.value === current) {
    action.value = null;
    announcement.value =
      current.kind === "delete"
        ? "댓글을 삭제했어요."
        : current.kind === "edit"
          ? "댓글을 수정했어요."
          : "답글을 등록했어요.";
  }
}
</script>
<template>
  <section
    class="post-comments"
    aria-labelledby="comments-heading"
    @keydown.esc.stop="!busy && (action = null)"
  >
    <header class="comments-heading">
      <h3 id="comments-heading">
        댓글 <span>{{ count }}</span>
      </h3>
    </header>
    <div v-if="loadError" class="comments-error" role="alert">
      {{ loadError }} <button @click="reload">다시 시도</button>
    </div>
    <p
      v-else-if="loading && !threads.length"
      class="comments-empty"
      role="status"
    >
      댓글을 불러오는 중이에요.
    </p>
    <template v-else>
      <CommentComposer
        v-if="user"
        :key="`${user.id}-${postKey}-${composerVersion}`"
        :busy="busy"
        @submit="submitRoot"
      />
      <div v-else class="comments-login">
        <span>로그인하고 이야기를 나눠보세요.</span
        ><RouterLink
          :to="{ name: 'login', query: { redirect: route.fullPath } }"
          >로그인</RouterLink
        >
      </div>
      <p v-if="!threads.length" class="comments-empty">첫 댓글을 남겨보세요.</p>
      <ol v-else class="comment-threads">
        <li v-for="thread in threads" :key="thread.id" class="comment-thread">
          <CommentItem
            v-for="comment in thread.items"
            :key="comment.id"
            :comment="comment"
            :viewer-id="user?.id"
            :post-author-id="post.author?.id"
            :busy="busy"
            @reply="begin('reply', comment)"
            @edit="begin('edit', comment)"
            @remove="begin('delete', comment)"
          >
            <template v-if="action?.comment.id === comment.id && user">
              <div
                v-if="action.kind === 'delete'"
                class="comment-delete-confirm"
                role="group"
                aria-label="댓글 삭제 확인"
              >
                <span>댓글을 삭제할까요?</span>
                <button :disabled="busy" @click="action = null">취소</button>
                <button
                  :disabled="busy"
                  class="comment-delete-approve"
                  @click="submitAction()"
                >
                  삭제
                </button>
              </div>
              <CommentComposer
                v-else
                :key="`${comment.id}-${action.kind}`"
                :initial-value="action.kind === 'edit' ? comment.content : ''"
                :label="action.kind === 'edit' ? '댓글 수정 내용' : '답글 내용'"
                :submit-label="action.kind === 'edit' ? '수정' : '답글 등록'"
                :busy="busy"
                cancellable
                @submit="submitAction"
                @cancel="action = null"
              />
            </template>
          </CommentItem>
        </li>
      </ol>
    </template>
    <p v-if="error" class="comments-error" role="alert">{{ error }}</p>
    <p class="visually-hidden" role="status">{{ announcement }}</p>
  </section>
</template>
<style scoped>
.post-comments {
  margin-top: 56px;
  padding-top: 28px;
  border-top: 1px solid var(--theme-border);
  font-size: var(--font-size-min);
}
.comments-heading h3 {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 22px;
  font-size: 18px;
  font-weight: 650;
}
.comments-heading h3 span {
  color: var(--theme-muted);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  font-weight: 450;
}
.comments-login {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 18px;
  border-radius: 10px;
  background: var(--theme-raised);
  color: var(--theme-muted);
}
.comments-login a {
  color: var(--theme-accent);
  font-weight: 600;
  flex-shrink: 0;
  padding: 6px 0;
}
.post-comments .comments-empty {
  text-align: center;
  color: var(--theme-muted);
  padding: 22px 0;
  font-size: inherit;
}
.comment-threads {
  list-style: none;
  margin: 18px 0 0;
  padding: 0;
}
.comment-thread + .comment-thread {
  border-top: 1px solid var(--theme-border);
}
.comment-delete-confirm {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--theme-raised);
  font-size: 12px;
}
.comment-delete-confirm span {
  margin-right: auto;
}
.comment-delete-confirm button {
  padding: 6px 8px;
  border-radius: 6px;
  color: var(--theme-muted);
}
.comment-delete-confirm .comment-delete-approve {
  color: var(--theme-text);
  background: var(--theme-surface);
}
.post-comments .comments-error {
  font-size: inherit;
  color: var(--theme-text);
  padding: 12px 0;
}
.comments-error button {
  text-decoration: underline;
}
@media (max-width: 600px) {
  .post-comments {
    margin-top: 36px;
    padding-top: 22px;
  }
  .comments-heading h3 {
    font-size: 16px;
    margin-bottom: 16px;
  }
  .comments-heading h3 span {
    font-size: 12px;
  }
  .comments-login {
    padding: 12px;
  }
}
</style>
