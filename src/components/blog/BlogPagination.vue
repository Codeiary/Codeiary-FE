<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import Icon from "@/components/Icon.vue";

const props = defineProps<{ page: number; pageCount: number }>();
const emit = defineEmits<{ select: [page: number] }>();
const route = useRoute();

function pageHref(page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(route.query)) {
    if (key === "page") continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (typeof item === "string") query.append(key, item);
    }
  }
  if (page > 1) query.set("page", String(page));
  return `${route.path}${query.size ? `?${query}` : ""}`;
}

function select(event: MouseEvent, page: number) {
  if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (page >= 1 && page <= props.pageCount && page !== props.page) emit("select", page);
}

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
    <a
      class="pagination-direction pagination-previous"
      aria-label="이전 페이지"
      :href="page > 1 ? pageHref(page - 1) : undefined"
      :aria-disabled="page <= 1 || undefined"
      @click="select($event, page - 1)"
    >
      <Icon name="chevron" :size="16" />
    </a>
    <template v-for="item in items" :key="item">
      <a
        v-if="typeof item === 'number'"
        :aria-label="`${item}페이지`"
        :aria-current="item === page ? 'page' : undefined"
        :href="pageHref(item)"
        @click="select($event, item)"
      >{{ item }}</a>
      <span v-else class="pagination-ellipsis" aria-hidden="true">…</span>
    </template>
    <a
      class="pagination-direction"
      aria-label="다음 페이지"
      :href="page < pageCount ? pageHref(page + 1) : undefined"
      :aria-disabled="page >= pageCount || undefined"
      @click="select($event, page + 1)"
    >
      <Icon name="chevron" :size="16" />
    </a>
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
.blog-pagination a,
.pagination-ellipsis {
  display: grid;
  place-items: center;
  min-width: 36px;
  height: 36px;
  padding-inline: 6px;
  border-radius: 9px;
  color: var(--theme-muted);
  font-variant-numeric: tabular-nums;
  text-decoration: none;
}
.blog-pagination a[href]:hover {
  background: var(--theme-raised);
  color: var(--theme-text);
}
.blog-pagination a[aria-current="page"] {
  background: var(--theme-raised);
  color: var(--theme-text);
  font-weight: 650;
}
.blog-pagination a[aria-disabled="true"] {
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
