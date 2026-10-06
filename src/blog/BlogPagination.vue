<script setup lang="ts">
import { computed } from "vue";
import Icon from "../components/Icon.vue";

const props = defineProps<{ page: number; pageCount: number }>();
defineEmits<{ select: [page: number] }>();

const items = computed(() => {
  const total = props.pageCount;
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  if (props.page <= 4) return [1, 2, 3, 4, 5, "end", total];
  if (props.page >= total - 3)
    return [1, "start", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "start", props.page - 1, props.page, props.page + 1, "end", total];
});
</script>

<template>
  <nav class="blog-pagination" aria-label="게시글 페이지">
    <button
      class="pagination-direction pagination-previous"
      aria-label="이전 페이지"
      :disabled="page <= 1"
      @click="$emit('select', page - 1)"
    >
      <Icon name="chevron" :size="16" />
    </button>
    <template v-for="item in items" :key="item">
      <button
        v-if="typeof item === 'number'"
        :aria-label="`${item}페이지`"
        :aria-current="item === page ? 'page' : undefined"
        @click="item !== page && $emit('select', item)"
      >{{ item }}</button>
      <span v-else class="pagination-ellipsis" aria-hidden="true">…</span>
    </template>
    <button
      class="pagination-direction"
      aria-label="다음 페이지"
      :disabled="page >= pageCount"
      @click="$emit('select', page + 1)"
    >
      <Icon name="chevron" :size="16" />
    </button>
  </nav>
</template>

<style scoped>
.blog-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 32px;
  padding-block: 8px 12px;
  font-size: var(--font-size-min);
}
.blog-pagination button,
.pagination-ellipsis {
  display: grid;
  place-items: center;
  min-width: 36px;
  height: 36px;
  padding-inline: 6px;
  border-radius: 9px;
  color: var(--theme-muted);
  font-variant-numeric: tabular-nums;
}
.blog-pagination button:hover:not(:disabled) {
  background: var(--theme-raised);
  color: var(--theme-text);
}
.blog-pagination button[aria-current="page"] {
  background: var(--theme-raised);
  color: var(--theme-text);
  font-weight: 650;
}
.blog-pagination button:disabled {
  opacity: 0.3;
  cursor: default;
}
.pagination-previous svg {
  transform: rotate(180deg);
}
@media (max-width: 600px) {
  .blog-pagination {
    gap: 2px;
  }
  .blog-pagination .pagination-direction {
    display: none;
  }
}
</style>
