import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type Ref,
} from "vue";
import { auth } from "@/store/auth";
import {
  createComment,
  deleteComment,
  readComments,
  updateComment,
} from "@/services/comment-storage";
import { commentThreads, type BlogComment } from "@/utils/blog/comments";

export function useComments(postKey: Ref<string>) {
  const comments = shallowRef<BlogComment[]>([]);
  const loading = ref(true);
  const busy = ref(false);
  const error = ref("");
  const loadError = ref("");
  let generation = 0;
  let disposed = false;
  async function reload() {
    const version = ++generation;
    const key = postKey.value;
    loading.value = true;
    loadError.value = "";
    try {
      const result = await readComments(key);
      if (!disposed && version === generation) comments.value = result;
    } catch {
      if (!disposed && version === generation)
        loadError.value = "댓글을 불러오지 못했어요. 다시 시도해 주세요.";
    } finally {
      if (!disposed && version === generation) loading.value = false;
    }
  }
  watch(
    postKey,
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
  const refresh = () => {
    if (!busy.value) void reload();
  };
  onMounted(() => window.addEventListener("focus", refresh));
  onBeforeUnmount(() => {
    disposed = true;
    generation++;
    window.removeEventListener("focus", refresh);
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
    add: (content: string, parentId: string | null = null) =>
      mutate(() =>
        createComment(postKey.value, auth.user.value, content, parentId),
      ),
    edit: (id: string, content: string) =>
      mutate(() => updateComment(postKey.value, id, auth.user.value, content)),
    remove: (id: string) =>
      mutate(() => deleteComment(postKey.value, id, auth.user.value)),
  };
}
