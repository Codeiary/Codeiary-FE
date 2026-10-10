<script setup lang="ts">
import { computed } from "vue";
import OutlineBranch from "@/components/blog/OutlineBranch.vue";
import {
  buildHeadingTree,
  type ArticleHeading,
} from "@/utils/blog/heading-outline";
const props = defineProps<{ headings: ArticleHeading[]; activeId?: string }>();
defineEmits<{ navigate: [id: string] }>();
const tree = computed(() => buildHeadingTree(props.headings));
</script>
<template>
  <aside v-if="headings.length" class="article-outline">
    <nav aria-label="소제목 목차">
      <OutlineBranch
        :nodes="tree"
        :active-id="activeId"
        @navigate="$emit('navigate', $event)"
      />
    </nav>
  </aside>
</template>
<style>
.article-outline {
  position: fixed;
  right: max(24px, env(safe-area-inset-right));
  bottom: calc(37px + env(safe-area-inset-bottom));
  width: clamp(128px, calc((100vw - 820px) / 2 - 104px), 160px);
  color: var(--theme-muted);
  font-size: 13px;
}
.article-outline nav {
  max-height: min(40dvh, 320px);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--theme-border) transparent;
}
.article-outline nav > .outline-branch {
  border-left: 1px solid var(--theme-border);
}
.outline-branch {
  list-style: none;
  margin: 0;
  padding: 0;
}
.outline-branch .outline-branch {
  margin: 2px 0 5px 9px;
  border-left: 1px solid
    color-mix(in srgb, var(--theme-border) 65%, transparent);
}
.outline-branch button {
  position: relative;
  display: block;
  width: 100%;
  padding: 5px 10px;
  border-radius: 0 5px 5px 0;
  color: var(--theme-muted);
  text-align: left;
  font-size: inherit;
  font-weight: 450;
  line-height: 1.5;
  overflow-wrap: anywhere;
  transition:
    color 0.15s,
    background-color 0.15s;
}
.article-outline nav > .outline-branch > li > button {
  font-weight: 600;
  color: var(--theme-text);
}
.article-outline .outline-branch button[aria-current="location"] {
  color: var(--theme-accent);
  background: color-mix(in srgb, var(--theme-accent) 7%, transparent);
}
.outline-branch button[aria-current="location"]::before {
  content: "";
  position: absolute;
  left: -1px;
  top: 6px;
  bottom: 6px;
  width: 2px;
  border-radius: 2px;
  background: var(--theme-accent);
}
.outline-branch button:hover {
  color: var(--theme-accent);
  background: color-mix(in srgb, var(--theme-raised) 60%, transparent);
}
.outline-branch button:focus-visible {
  outline-offset: -2px;
}
@media (max-width: 1279px) {
  .article-outline {
    display: none;
  }
}
</style>
