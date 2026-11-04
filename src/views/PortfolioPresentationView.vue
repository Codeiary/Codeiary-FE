<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import PortfolioDocument from "@/components/portfolio/PortfolioDocument.vue";
import { fetchPortfolio } from "@/services/portfolio-api";
import type { PortfolioItem } from "@/store/portfolio";
import { portfolioRoute } from "@/utils/portfolio/routes";
const route = useRoute();
const router = useRouter();
const item = shallowRef<PortfolioItem>();
const loading = ref(true);
const error = ref("");
const post = computed(() => item.value ? { ...item.value, category: "", tags: [], date: "", imageLayouts: {} } : undefined);
let request = 0;
watch(() => route.params.portfolioId, async () => {
  if (import.meta.env.SSR) return;
  const revision = ++request;
  item.value = undefined;
  error.value = "";
  loading.value = true;
  try {
    const result = await fetchPortfolio(Number(route.params.portfolioId));
    if (revision !== request) return;
    item.value = result;
    const canonical = portfolioRoute(result, true);
    if (route.params.portfolioSlug !== canonical.params.portfolioSlug) await router.replace(canonical);
  } catch (reason) {
    if (revision === request) error.value = reason instanceof Error ? reason.message : "포트폴리오를 불러오지 못했어요.";
  } finally { if (revision === request) loading.value = false; }
}, { immediate: true });
onBeforeUnmount(() => { request++; });
</script>
<template>
  <main class="portfolio-presentation" :aria-busy="loading" aria-label="포트폴리오 전체 화면 보기">
    <p v-if="error" class="portfolio-presentation-error" role="alert">{{ error }}</p>
    <PortfolioDocument v-else-if="item && post" :post="post" :blocks="item.blocks" :title-runs="item.titleRuns" :title-align="item.titleAlign" :default-font="item.defaultFont" />
  </main>
</template>
<style scoped>
.portfolio-presentation { min-height: 100vh; min-height: 100dvh; width: 100%; margin: 0; background: #fff; color: #303d35; }
.portfolio-presentation :deep(.portfolio-document) { border-radius: 0; min-height: var(--portfolio-page-height); }
.portfolio-presentation :deep(.portfolio-document-visibility) { display: none; }
.portfolio-presentation-error { margin: 0; padding: 40px; text-align: center; }
</style>
