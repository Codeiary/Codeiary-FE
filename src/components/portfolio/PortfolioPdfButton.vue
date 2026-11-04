<script setup lang="ts">
import { waitForPortfolioFonts } from "@/utils/portfolio/fonts";
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import PortfolioDocument from "./PortfolioDocument.vue";
import { loadMarkdownContent } from "@/utils/blog/markdown-loader";
import type { PortfolioBlock, PortfolioTextRun } from "@/utils/portfolio/layout";
import { auth } from "@/store/auth";

const props = defineProps<{
  post: InstanceType<typeof PortfolioDocument>["$props"]["post"];
  blocks?: PortfolioBlock[];
  titleRuns?: PortfolioTextRun[];
  defaultFont?: string;
  titleAlign?: "left" | "center" | "right";
  disabled?: boolean;
  iconOnly?: boolean;
}>();
const canExport = computed(() => !!auth.user.value && props.post.author?.id === auth.user.value.id);
const printing = ref(false);
const error = ref("");
const output = ref<HTMLElement>();
let originalTitle: string | undefined;
function finish() {
  window.removeEventListener("afterprint", finish);
  if (originalTitle !== undefined) document.title = originalTitle;
  originalTitle = undefined;
  printing.value = false;
}
async function exportPdf() {
  if (printing.value || props.disabled || !canExport.value) return;
  error.value = "";
  printing.value = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await loadMarkdownContent();
    await nextTick();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const ready = async () => {
      if (output.value) await waitForPortfolioFonts(output.value);
      const images = Array.from(output.value?.querySelectorAll("img") ?? []);
      images.forEach((image) => { image.loading = "eager"; });
      await Promise.all([document.fonts?.ready, ...images.map((image) => image.decode())]);
      // Let the document's ResizeObserver update absolute block heights before printing.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await nextTick();
    };
    await Promise.race([ready(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("PDF preparation timed out")), 15_000);
    })]);
    clearTimeout(timer);
    if (!canExport.value || props.disabled) { finish(); return; }
    originalTitle = document.title;
    document.title = props.post.title.trim() || "포트폴리오";
    window.addEventListener("afterprint", finish, { once: true });
    window.print();
  } catch {
    finish();
    error.value = "PDF를 준비하지 못했어요. 이미지와 글꼴이 로드된 후 다시 시도해 주세요.";
  } finally {
    clearTimeout(timer);
  }
}
onBeforeUnmount(finish);
</script>

<template>
  <button v-if="canExport" type="button" class="portfolio-pdf-button" :class="{ 'portfolio-pdf-icon': iconOnly }" :disabled="disabled || printing" aria-label="PDF 내보내기" title="PDF 내보내기" @click="exportPdf">
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" /></svg>
    <span v-if="!iconOnly">{{ printing ? "PDF 준비 중…" : "PDF 내보내기" }}</span>
  </button>
  <p v-if="error" class="portfolio-pdf-error" role="alert">{{ error }}</p>
  <Teleport to="body">
    <div v-if="printing" ref="output" class="portfolio-print-root" aria-hidden="true">
      <PortfolioDocument :post="post" :default-font="defaultFont" :blocks="blocks" :title-runs="titleRuns" :title-align="titleAlign" />
    </div>
  </Teleport>
</template>

<style>
.portfolio-pdf-button { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; gap: 6px; min-height: 36px; padding: 5px 9px; border: 0; border-radius: 7px; background: transparent; color: var(--theme-muted); font-size: 13px; white-space: nowrap; }
.portfolio-pdf-button:hover { background: var(--theme-raised); color: var(--theme-text); }
.portfolio-pdf-button:focus-visible { outline: 2px solid var(--theme-accent); outline-offset: 2px; }
.portfolio-pdf-button:disabled { opacity: .5; cursor: wait; }
.portfolio-pdf-icon { width: 32px; min-height: 32px; padding: 5px; }
.portfolio-pdf-error { position: fixed; z-index: 90; bottom: 20px; left: 50%; transform: translateX(-50%); max-width: calc(100% - 32px); padding: 12px 18px; border-radius: 8px; background: var(--theme-text); color: var(--theme-surface); font-size: 13px; }
.portfolio-print-root { position: fixed; top: 0; left: -100000px; width: var(--portfolio-page-width); color-scheme: light; --theme-text: #303d35; --theme-muted: #747f70; --theme-surface: #fff; --theme-raised: #f4f2ea; --theme-border: #dedfd5; --theme-accent: #c46640; }
.portfolio-print-root .portfolio-document { min-height: var(--portfolio-page-height); border-radius: 0; }
@page { size: A4 portrait; margin: 0; }
@media print {
  html:has(.portfolio-print-root), body:has(> .portfolio-print-root) { display: block !important; width: auto !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; background: #fff !important; }
  body:has(> .portfolio-print-root) > :not(.portfolio-print-root) { display: none !important; }
  .portfolio-print-root { position: static; width: var(--portfolio-page-width); margin: 0; padding: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .portfolio-print-root .portfolio-document { min-height: 0; box-decoration-break: clone; -webkit-box-decoration-break: clone; box-shadow: none; }
  .portfolio-print-root .portfolio-document-actions, .portfolio-print-root .portfolio-document-visibility { display: none; }
  .portfolio-print-root .portfolio-block-content { overflow: visible; }
  .portfolio-print-root :is(h1, h2, h3) { break-after: avoid; }
  .portfolio-print-root :is(img, pre, tr) { break-inside: avoid; }
}
</style>
