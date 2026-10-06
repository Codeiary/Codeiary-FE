<script setup lang="ts">
defineProps<{
  categories: { name: string; count: number }[];
  total: number;
  selected: string;
}>();
defineEmits<{ select: [category: string] }>();
</script>

<template>
  <nav class="blog-categories" aria-label="블로그 카테고리">
    <ul>
      <li>
        <button
          :aria-current="selected === '' ? 'true' : undefined"
          @click="$emit('select', '')"
        >
          <span>전체</span><span class="category-count">{{ total }}</span>
        </button>
      </li>
      <li v-for="category in categories" :key="category.name">
        <button
          :aria-current="selected === category.name ? 'true' : undefined"
          @click="$emit('select', category.name)"
        >
          <span>{{ category.name }}</span
          ><span class="category-count">{{ category.count }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.blog-categories {
  position: sticky;
  top: 0;
  align-self: start;
  max-height: calc(100dvh - 240px);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--theme-border) transparent;
}
ul {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  min-height: 44px;
  padding: 11px 14px;
  border-radius: 10px;
  color: var(--theme-muted);
  font-size: var(--font-size-min);
  line-height: 1.5;
  text-align: left;
  transition:
    background-color 160ms,
    color 160ms;
}
button > span:first-child {
  min-width: 0;
  overflow-wrap: anywhere;
}
button:hover {
  color: var(--theme-text);
  background: var(--theme-raised);
}
button[aria-current="true"] {
  background: var(--theme-raised);
  color: var(--theme-text);
  font-weight: 650;
}
.category-count {
  flex-shrink: 0;
  color: var(--theme-muted);
  font-size: var(--font-size-min);
  font-variant-numeric: tabular-nums;
}
@media (max-width: 760px) {
  .blog-categories {
    position: static;
    max-height: none;
    overflow-x: auto;
    scrollbar-width: none;
  }
  ul {
    display: flex;
    gap: 6px;
  }
  li {
    flex-shrink: 0;
  }
  button {
    gap: 10px;
    white-space: nowrap;
    padding-inline: 12px;
  }
}
</style>
