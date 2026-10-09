import {
  computed,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
  type Ref,
} from "vue";
import {
  createComment,
  deleteComment,
  readComments,
  updateComment,
} from "@/services/comment-api";
import { commentThreads, type Comment } from "@/utils/blog/comments";

export function useComments(postId: Ref<number>) {
  const comments = shallowRef<Comment[]>([]);
  const loading = ref(true);
  const busy = ref(false);
  const error = ref("");
  const loadError = ref("");
  let generation = 0;
  let disposed = false;
  async function reload() {
    const version = ++generation;
    const id = postId.value;
    loading.value = true;
    loadError.value = "";
    try {
      const result = await readComments(id);
      if (!disposed && version === generation) comments.value = result;
    } catch {
      if (!disposed && version === generation)
        loadError.value = "댓글을 불러오지 못했어요. 다시 시도해 주세요.";
    } finally {
      if (!disposed && version === generation) loading.value = false;
    }
  }
  watch(
    postId,
    () => {
      comments.value = [];
      error.value = "";
      void reload();
    },
    { immediate: true },
  );
  async function mutate(action: () => Promise<unknown>) {
    if (busy.value) return false;
    busy.value = true;
    error.value = "";
    try {
      await action();
      await reload();
      return true;
    } catch (reason) {
      error.value =
        reason instanceof Error
          ? reason.message
          : "저장하지 못했어요. 다시 시도해 주세요.";
      return false;
    } finally {
      busy.value = false;
    }
  }
  onBeforeUnmount(() => {
    disposed = true;
    generation++;
  });
  return {
    threads: computed(() => commentThreads(comments.value)),
    count: computed(
      () => comments.value.filter((comment) => !comment.deleted).length,
    ),
    loading,
    busy,
    error,
    loadError,
    reload,
    add: (content: string, parentId: number | null = null) =>
      mutate(() => createComment(postId.value, content, parentId)),
    edit: (id: number, content: string) =>
      mutate(() => updateComment(postId.value, id, content)),
    remove: (id: number) =>
      mutate(() => deleteComment(postId.value, id)),
  };
}
