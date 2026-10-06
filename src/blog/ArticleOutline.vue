<script setup lang="ts">
import { computed } from "vue";
import OutlineBranch from "./OutlineBranch.vue";
import { buildHeadingTree, type ArticleHeading } from "./heading-outline";
const props = defineProps<{ headings: ArticleHeading[] }>();
defineEmits<{ navigate: [id: string] }>();
const tree = computed(() => buildHeadingTree(props.headings));
</script>
<template>
  <aside v-if="headings.length" class="article-outline">
    <nav aria-label="소제목 목차">
      <OutlineBranch :nodes="tree" @navigate="$emit('navigate', $event)" />
    </nav>
  </aside>
</template>
<style>
.article-outline {
  position: absolute;
  right: calc(100% + 76px);
  top: 0;
  width: clamp(128px, calc((100vw - 820px) / 2 - 104px), 160px);
  height: 100%;
  color: var(--theme-muted);
  font-size: var(--font-size-min);
}
.article-outline nav {
  position: sticky;
  top: 24px;
  max-height: calc(100dvh - 210px);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--theme-border) transparent;
}
.outline-branch {
  list-style: none;
  margin: 0;
  padding: 0;
}
.outline-branch .outline-branch {
  margin: 0 0 2px;
  padding-left: 6px;
}
.outline-branch button {
  display: block;
  width: 100%;
  padding: 4px 0;
  color: var(--theme-text);
  text-align: left;
  font-size: inherit;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.outline-branch .outline-branch button {
  color: var(--theme-muted);
  font-size: var(--font-size-min);
}
.outline-branch button:hover {
  color: var(--theme-accent);
}
@media (max-width: 1279px) {
  .article-outline {
    display: none;
  }
}
</style>
