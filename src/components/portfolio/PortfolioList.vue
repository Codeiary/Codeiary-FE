<script setup lang="ts">
import Icon from "@/components/Icon.vue";
import type { PortfolioItem } from "@/store/portfolio";
import { displayName } from "@/utils/profile/display-name";

defineProps<{ items: readonly PortfolioItem[] }>();
defineEmits<{ select: [item: PortfolioItem] }>();
</script>

<template>
  <div class="portfolio-feed">
    <button
      v-for="item in items"
      :key="item.id"
      class="portfolio-entry"
      :aria-label="`${item.title} 포트폴리오 보기`"
      @click="$emit('select', item)"
    >
      <div class="portfolio-entry-copy">
        <h3>{{ item.title }}</h3>
        <p v-if="item.summary">{{ item.summary }}</p>
        <div class="portfolio-entry-meta">
          <span>{{ displayName(item.author) }}</span>
          <span v-if="item.visibility === 'PRIVATE'" class="portfolio-entry-visibility">
            <Icon name="lock" :size="13" /> 비공개
          </span>
        </div>
      </div>
      <Icon class="portfolio-entry-arrow" name="arrow-right" :size="19" />
    </button>
  </div>
</template>

<style scoped>
.portfolio-feed { border-top: 1px solid var(--theme-border); }
.portfolio-entry { display: grid; grid-template-columns: minmax(0, 1fr) 20px; align-items: center; gap: 24px; width: 100%; padding: 26px 12px; border-bottom: 1px solid var(--theme-border); color: var(--theme-text); background: transparent; text-align: left; transition: background .18s; }
.portfolio-entry:hover { background: var(--theme-raised); }
.portfolio-entry:focus-visible { outline: 2px solid var(--theme-accent); outline-offset: -2px; border-radius: 6px; }
.portfolio-entry-copy { min-width: 0; overflow-wrap: anywhere; }
.portfolio-entry h3 { margin: 0; color: inherit; font-size: 22px; font-weight: 650; line-height: 1.45; letter-spacing: -.6px; }
.portfolio-entry p { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; margin: 8px 0 0; color: var(--theme-muted); font-size: 15px; line-height: 1.7; }
.portfolio-entry-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; margin-top: 14px; color: var(--theme-muted); font-size: 13px; }
.portfolio-entry-visibility { display: inline-flex; align-items: center; gap: 4px; }
.portfolio-entry-arrow { color: var(--theme-muted); opacity: .6; transition: color .18s, transform .18s; }
.portfolio-entry:hover .portfolio-entry-arrow { color: var(--theme-accent); opacity: 1; transform: translateX(3px); }
@media (max-width: 600px) {
  .portfolio-entry { padding: 21px 4px; gap: 16px; }
  .portfolio-entry h3 { font-size: 19px; }
  .portfolio-entry p { font-size: 14px; }
}
</style>
