<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { JSONContent } from "@tiptap/core";
import Icon from "@/components/Icon.vue";
import CoverImage from "@/components/blog/CoverImage.vue";
import PortfolioRichContent from "./PortfolioRichContent.vue";
import PortfolioMarkdownBlock from "./PortfolioMarkdownBlock.vue";
import { loadMarkdownContent } from "@/utils/blog/markdown-loader";
import type { BlogPost } from "@/utils/blog/posts";
import { blocksToMarkdown, PORTFOLIO_TITLE_ID, normalizeBlockPosition, type PortfolioBlock, type PortfolioBlockPosition, type PortfolioTextRun } from "@/utils/portfolio/layout";
import { normalizeTextRuns, textRunStyle } from "@/utils/portfolio/rich-text";
import { loadPortfolioFont, portfolioFonts, portfolioFontFamily } from "@/utils/portfolio/fonts";
import "@/assets/styles/syntax.css";
import "@/assets/styles/portfolio-page.css";

const RichEditor = defineAsyncComponent(() => import("./PortfolioRichTextEditor.vue"));
const MarkdownContent = defineAsyncComponent(loadMarkdownContent);
const props = withDefaults(defineProps<{
  post: Pick<BlogPost, "title" | "category" | "tags" | "author" | "date" | "visibility" | "coverImage" | "content" | "imageLayouts">;
  blocks?: PortfolioBlock[];
  titleRuns?: PortfolioTextRun[];
  titleAlign?: "left" | "center" | "right";
  showHeader?: boolean;
  editable?: boolean;
  selectedBlock?: string;
  toolbarTarget?: string;
}>(), { showHeader: true, editable: false });
const emit = defineEmits<{
  selectBlock: [id: string];
  "update:title": [title: string];
  "update:titleRuns": [runs: PortfolioTextRun[]];
  updateBlock: [id: string, patch: Partial<PortfolioBlock>];
}>();
const titleSelected = computed(() => props.editable && props.selectedBlock === PORTFOLIO_TITLE_ID);
const stage = ref<HTMLElement>();
const heights = ref<Record<string, number>>({});
function positionFor(block?: PortfolioBlock) { return block ? normalizeBlockPosition(block.position, block.type === "image" ? .1 : 10) : undefined; }
const free = computed(() => props.blocks?.some((block) => positionFor(block)) ?? false);
const positions = computed(() => {
  const result = new Map<string, PortfolioBlockPosition>();
  if (!free.value) return result;
  let bottom = 0;
  for (const block of props.blocks ?? []) {
    const position = positionFor(block);
    if (!position) continue;
    result.set(block.id, position);
    bottom = Math.max(bottom, position.y + (position.height ?? heights.value[block.id] ?? 80));
  }
  for (const block of props.blocks ?? []) {
    if (result.has(block.id)) continue;
    const position = { x: 0, y: bottom + 28, width: 100 };
    result.set(block.id, position);
    bottom = position.y + (heights.value[block.id] ?? 80);
  }
  return result;
});
const stageHeight = computed(() => Math.max(320, ...Array.from(positions.value, ([id, position]) => position.y + (position.height ?? heights.value[id] ?? 80) + 28)));
const displayedBlocks = computed(() => props.editable || !free.value ? props.blocks : [...(props.blocks ?? [])].sort((a, b) => positions.value.get(a.id)!.y - positions.value.get(b.id)!.y || positions.value.get(a.id)!.x - positions.value.get(b.id)!.x));
function elements() { return Array.from(stage.value?.children ?? []).filter((element): element is HTMLElement => element instanceof HTMLElement && !!element.dataset.blockId); }
function measure() {
  const next: Record<string, number> = {};
  elements().forEach((element) => { next[element.dataset.blockId!] = element.getBoundingClientRect().height || heights.value[element.dataset.blockId!] || 80; });
  if (JSON.stringify(next) !== JSON.stringify(heights.value)) heights.value = next;
}
let observer: ResizeObserver | undefined;
function observe() {
  observer?.disconnect();
  if (typeof ResizeObserver !== "undefined") {
    observer ??= new ResizeObserver(measure);
    elements().forEach((element) => observer!.observe(element));
  }
  measure();
}
watch(() => props.blocks?.map((block) => block.id).join("\u0000"), () => { void nextTick(observe); }, { flush: "post" });
onMounted(observe);
onBeforeUnmount(() => { observer?.disconnect(); finishDrag(); });
function select(id: string) { if (props.editable) emit("selectBlock", id); }
function updateTitle(value: { content: string; runs: PortfolioTextRun[] }) {
  let remaining = 160;
  const runs = value.runs.map((run) => {
    const text = run.text.replace(/[\r\n]+/g, " ").slice(0, remaining);
    remaining -= text.length;
    return { ...run, text };
  }).filter((run) => run.text);
  emit("update:title", runs.map((run) => run.text).join(""));
  emit("update:titleRuns", runs);
}
function titleEnter() { stage.value?.querySelector<HTMLButtonElement>(".portfolio-block-handle")?.focus(); }
function updateContent(id: string, value: { content: string; document?: JSONContent }) {
  emit("updateBlock", id, { type: "markdown", content: value.content, document: value.document, runs: undefined });
}
watch(() => [props.titleRuns, props.blocks], () => {
  normalizeTextRuns(props.titleRuns, props.post.title).forEach((run) => loadPortfolioFont(run.font));
  function visit(node?: JSONContent, depth = 0) {
    if (!node || depth > 64) return;
    for (const mark of node.marks ?? []) {
      const font = portfolioFonts.find((item) => item.family === mark.attrs?.fontFamily);
      if (font) loadPortfolioFont(font.id);
    }
    node.content?.forEach((child) => visit(child, depth + 1));
  }
  props.blocks?.forEach((block) => { block.runs?.forEach((run) => loadPortfolioFont(run.font)); visit(block.document); });
}, { deep: true, immediate: true });
function style(block: PortfolioBlock): Record<string, string> {
  const position = positions.value.get(block.id);
  return position ? { position: "absolute", left: `${position.x}%`, top: `${position.y}px`, width: `${position.width}%`, ...(position.height !== undefined ? { height: `${position.height}px` } : {}) } : {};
}
function fitImage(block: PortfolioBlock, event: Event) {
  const image = event.target;
  const bounds = stage.value?.getBoundingClientRect();
  if (!props.editable || block.type !== "image" || block.position?.height !== undefined
    || !(image instanceof HTMLImageElement) || !image.naturalWidth || !image.naturalHeight || !bounds?.width) return;
  const position = positions.value.get(block.id) ?? capturePositions()?.get(block.id);
  if (!position) return;
  const availableHeight = (stage.value?.closest(".portfolio-canvas-scroll")?.clientHeight || window.innerHeight) * .7;
  const scale = Math.min(1, bounds.width * (100 - position.x) / 100 / image.naturalWidth, availableHeight / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const normalized = normalizeBlockPosition({ ...position, width: width / bounds.width * 100 }, .1);
  if (normalized) emit("updateBlock", block.id, { position: { ...normalized, height: Math.max(32, bounds.width * normalized.width / 100 * image.naturalHeight / image.naturalWidth) } });
}
const handles = [
  { direction: "nw", label: "왼쪽 위" }, { direction: "n", label: "위" }, { direction: "ne", label: "오른쪽 위" }, { direction: "e", label: "오른쪽" },
  { direction: "se", label: "오른쪽 아래" }, { direction: "s", label: "아래" }, { direction: "sw", label: "왼쪽 아래" }, { direction: "w", label: "왼쪽" },
] as const;
type Direction = typeof handles[number]["direction"];
const dragging = ref<string>();
let drag: { id: string; pointerId: number; x: number; y: number; handle: HTMLElement; resize?: Direction; moved: boolean; origin?: PortfolioBlockPosition; height?: number; ratio?: number; last?: PortfolioBlockPosition } | undefined;
function startDrag(event: PointerEvent, id: string, resize?: Direction) {
  if (!props.editable || event.button !== 0 || event.isPrimary === false) return;
  event.preventDefault(); finishDrag(); select(id);
  const handle = event.currentTarget as HTMLElement;
  drag = { id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, handle, resize, moved: false };
  handle.setPointerCapture?.(event.pointerId);
}
function capturePositions() {
  const bounds = stage.value?.getBoundingClientRect();
  if (!bounds?.width) return;
  const captured = new Map<string, PortfolioBlockPosition>();
  elements().forEach((element) => {
    const block = props.blocks?.find((block) => block.id === element.dataset.blockId);
    if (!block) return;
    const rect = element.getBoundingClientRect();
    const position = positionFor(block) ?? normalizeBlockPosition({ x: (rect.left - bounds.left) / bounds.width * 100, y: rect.top - bounds.top, width: rect.width / bounds.width * 100 }, block.type === "image" ? .1 : 10);
    if (position) captured.set(block.id, position);
  });
  measure();
  captured.forEach((position, id) => { if (!positionFor(props.blocks?.find((block) => block.id === id))) emit("updateBlock", id, { position }); });
  return captured;
}
function moveDrag(event: PointerEvent) {
  const active = drag;
  if (!active || active.pointerId !== event.pointerId) return;
  if (!props.editable || !props.blocks?.some((block) => block.id === active.id)) { finishDrag(); return; }
  if (!active.moved && Math.hypot(event.clientX - active.x, event.clientY - active.y) < 5) return;
  event.preventDefault();
  if (!active.moved) {
    active.origin = capturePositions()?.get(active.id);
    if (!active.origin) { finishDrag(); return; }
    active.height = Math.max(32, active.origin.height ?? elements().find((element) => element.dataset.blockId === active.id)?.getBoundingClientRect().height ?? 32);
    if (props.blocks?.find((block) => block.id === active.id)?.type === "image") {
      const image = elements().find((element) => element.dataset.blockId === active.id)?.querySelector("img");
      if (image?.naturalWidth && image.naturalHeight) active.ratio = image.naturalWidth / image.naturalHeight;
    }
  }
  const width = stage.value?.getBoundingClientRect().width;
  if (!active.origin || !width) return;
  active.moved = true; dragging.value = active.id;
  const dx = (event.clientX - active.x) / width * 100;
  const dy = event.clientY - active.y;
  const next = { ...active.origin };
  if (!active.resize) { next.x += dx; next.y += dy; }
  else if (active.ratio) {
    const west = active.resize.includes("w");
    const north = active.resize.includes("n");
    const horizontal = west ? -dx : dx;
    const vertical = (north ? -dy : dy) * active.ratio / width * 100;
    const delta = Math.abs(horizontal) >= Math.abs(vertical) ? horizontal : vertical;
    const maximum = Math.min(west ? next.x + next.width : 100 - next.x, north ? (next.y + active.height!) * active.ratio / width * 100 : 100);
    const minimum = Math.max(.1, 32 * active.ratio / width * 100);
    const resizedWidth = Math.min(maximum, Math.max(minimum, next.width + delta));
    const resizedHeight = width * resizedWidth / 100 / active.ratio;
    if (west) next.x += next.width - resizedWidth;
    if (north) next.y += active.height! - resizedHeight;
    next.width = resizedWidth; next.height = resizedHeight;
  } else {
    if (active.resize.includes("e")) next.width = Math.max(10, Math.min(100 - next.x, next.width + dx));
    if (active.resize.includes("w")) { const right = next.x + next.width; next.x = Math.max(0, Math.min(right - 10, next.x + dx)); next.width = right - next.x; }
    if (active.resize.includes("s")) next.height = active.height! + dy;
    if (active.resize.includes("n")) { const bottom = next.y + active.height!; next.y = Math.max(0, Math.min(bottom - 32, next.y + dy)); next.height = bottom - next.y; }
  }
  const position = normalizeBlockPosition(next, active.ratio ? .1 : 10);
  if (position && JSON.stringify(position) !== JSON.stringify(active.last)) { active.last = position; emit("updateBlock", active.id, { position }); }
}
function finishDrag() {
  const active = drag; drag = undefined; dragging.value = undefined;
  if (active?.handle.hasPointerCapture?.(active.pointerId)) active.handle.releasePointerCapture(active.pointerId);
}
function endDrag(event: PointerEvent) { if (drag?.pointerId !== event.pointerId) return; if (drag.moved) moveDrag(event); finishDrag(); }
function cancelDrag(event: PointerEvent) { if (drag?.pointerId === event.pointerId) finishDrag(); }
watch(() => props.editable, (editable) => { if (!editable) finishDrag(); });
</script>

<template>
  <article class="portfolio-document portfolio-article" :class="{ 'portfolio-document-editable': editable }" :style="{ '--portfolio-font': portfolioFontFamily() }">
    <header v-if="showHeader" class="portfolio-document-header" :style="{ textAlign: titleAlign ?? 'left' }">
      <CoverImage v-if="post.coverImage" class="portfolio-document-cover" :src="post.coverImage" :author-id="post.author?.id" loading="eager" />
      <span v-if="post.visibility === 'PRIVATE'" class="portfolio-document-visibility"><Icon name="lock" :size="12" /> 비공개</span>
      <div v-if="titleSelected" class="portfolio-document-title">
        <RichEditor :content="post.title" :runs="titleRuns" heading single-line :default-size="36" :toolbar-target="toolbarTarget" label="포트폴리오 제목 직접 편집" placeholder="제목을 입력하세요" @focus="select(PORTFOLIO_TITLE_ID)" @change="updateTitle" @enter="titleEnter" />
      </div>
      <h2 v-else class="portfolio-document-title" :tabindex="editable ? 0 : undefined" @click="select(PORTFOLIO_TITLE_ID)" @focus="select(PORTFOLIO_TITLE_ID)">
        <span v-if="!post.title && editable" class="portfolio-title-placeholder">제목을 입력하세요</span>
        <span v-for="(run, index) in normalizeTextRuns(titleRuns, post.title)" :key="index" :style="textRunStyle(run)">{{ run.text }}</span>
      </h2>
      <div v-if="$slots.actions" class="portfolio-document-actions"><slot name="actions" /></div>
    </header>
    <div v-if="blocks !== undefined" ref="stage" class="portfolio-document-blocks" :class="{ 'portfolio-document-free': free }" :style="free ? { height: `${stageHeight}px` } : {}">
      <div v-for="block in displayedBlocks" :key="block.id" class="portfolio-document-block" :data-block-id="block.id" :style="style(block)"
        :class="[`portfolio-block-${block.type}`, `portfolio-block-align-${block.align}`, { 'portfolio-block-selected': editable && selectedBlock === block.id, 'portfolio-block-dragging': dragging === block.id, 'portfolio-block-fixed-height': positions.get(block.id)?.height !== undefined }]"
        :role="editable ? 'group' : undefined" :aria-label="editable ? `${block.type === 'image' ? '이미지' : '본문'} 블록` : undefined" @click="select(block.id)">
        <button v-if="editable" class="portfolio-block-handle" :aria-label="`${block.type === 'image' ? '이미지' : '본문'} 블록 선택. 드래그하여 이동`" :aria-pressed="selectedBlock === block.id"
          @click.stop="select(block.id)" @pointerdown.stop="startDrag($event, block.id)" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="cancelDrag" @lostpointercapture="cancelDrag" @dragstart.prevent><span aria-hidden="true">⠿</span></button>
        <template v-if="editable && selectedBlock === block.id">
          <button v-for="handle in (block.type === 'image' ? handles.filter((handle) => handle.direction.length === 2) : handles)" :key="handle.direction" type="button" tabindex="-1" class="portfolio-block-resize" :class="`portfolio-resize-${handle.direction}`" :data-resize="handle.direction" :aria-label="`${handle.label} 크기 조절`" :title="`${handle.label} 크기 조절`"
            @click.stop @pointerdown.stop="startDrag($event, block.id, handle.direction)" @pointermove="moveDrag" @pointerup="endDrag" @pointercancel="cancelDrag" @lostpointercapture="cancelDrag" @dragstart.prevent></button>
        </template>
        <div class="portfolio-block-content portfolio-formatted-content" @load.capture="fitImage(block, $event)">
          <RichEditor v-if="editable && selectedBlock === block.id && block.type !== 'image'" flow
            :content="blocksToMarkdown([block])" :document="block.document" :source-blocks="[block]" :toolbar-target="toolbarTarget" @change="updateContent(block.id, $event)" />
          <PortfolioRichContent v-else-if="block.document" :document="block.document" />
          <PortfolioMarkdownBlock v-else-if="block.type === 'markdown'" :content="block.content" />
          <p v-else-if="block.type === 'text'" class="portfolio-block-text"><span v-for="(run, index) in normalizeTextRuns(block.runs, block.content)" :key="index" :style="textRunStyle(run)">{{ run.text }}</span></p>
          <MarkdownContent v-else-if="block.type === 'image' && block.imageUrl" :content="blocksToMarkdown([block])" :author-id="post.author?.id ?? ''" :image-layouts="post.imageLayouts" />
          <div v-else-if="block.type === 'image' && !block.imageUrl && editable" class="portfolio-block-placeholder">이미지를 추가하세요</div>
          <MarkdownContent v-else :content="blocksToMarkdown([block])" :author-id="post.author?.id ?? ''" :image-layouts="post.imageLayouts" />
        </div>
      </div>
    </div>
    <MarkdownContent v-else :content="post.content ?? ''" :author-id="post.author?.id ?? ''" :image-layouts="post.imageLayouts" />
  </article>
</template>

<style>
.portfolio-document { box-sizing: border-box; width: 100%; max-width: var(--portfolio-page-width); margin-inline: auto; padding: 40px 36px; border-radius: 8px; background: var(--theme-surface); color: var(--theme-text); font-family: var(--portfolio-font, inherit); font-size: 16px; line-height: 1.8; overflow-wrap: anywhere; container: portfolio-document / inline-size; }
.portfolio-document-header { margin-bottom: 48px; }
.portfolio-document-actions { display: flex; justify-content: flex-end; align-items: center; min-height: 40px; margin-top: 12px; text-align: left; }
.portfolio-document-title { margin: 0; color: inherit; font: 700 36px/1.3 var(--portfolio-font, inherit); letter-spacing: -.035em; overflow-wrap: anywhere; }
.portfolio-document-editable .portfolio-document-title { cursor: text; }
.portfolio-document-title:focus-visible { outline: 2px solid var(--theme-accent); outline-offset: 5px; }
.portfolio-document-title .tiptap { min-height: 1.3em; }
.portfolio-title-placeholder { color: var(--theme-muted); opacity: .65; }
.portfolio-document-cover { width: 100%; max-height: 320px; object-fit: cover; border-radius: 6px; margin-bottom: 28px; }
.portfolio-document-visibility { display: inline-flex; align-items: center; gap: 5px; margin-bottom: 12px; font-size: 12px; color: var(--theme-muted); }
.portfolio-document-blocks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px; align-items: start; }
.portfolio-document-free { position: relative; display: block; min-height: 320px; }
.portfolio-document-block { box-sizing: border-box; position: relative; min-width: 0; grid-column: 1 / -1; border-radius: 4px; }
.portfolio-block-content { min-width: 0; }
.portfolio-block-fixed-height > .portfolio-block-content { height: 100%; overflow: auto; overscroll-behavior: contain; }
.portfolio-block-image > .portfolio-block-content { overflow: hidden; }
.portfolio-block-text { white-space: pre-wrap; }

.portfolio-block-align-center { text-align: center; }
.portfolio-block-align-right { text-align: right; }
.portfolio-block-placeholder { display: grid; place-items: center; min-height: 100px; border: 1px dashed var(--theme-border); color: var(--theme-muted); }
.portfolio-document-editable .portfolio-document-block { min-height: 24px; outline: 1px solid transparent; outline-offset: 7px; }
.portfolio-document-editable .portfolio-document-block:hover { outline-color: var(--theme-border); }
.portfolio-document-editable .portfolio-block-selected { outline: 2px solid var(--theme-accent); z-index: 2; }
.portfolio-block-dragging { z-index: 3; opacity: .75; }
.portfolio-block-handle { position: absolute; z-index: 4; top: -31px; left: -8px; min-height: 24px; padding: 3px 8px; border: 1px solid var(--theme-accent); border-radius: 4px; background: var(--theme-surface); color: var(--theme-text); font: 600 11px/1.5 sans-serif; cursor: grab; touch-action: none; user-select: none; opacity: 0; }
.portfolio-document-block:is(:hover, :focus-within, .portfolio-block-selected) > .portfolio-block-handle { opacity: 1; }
.portfolio-block-resize { position: absolute; z-index: 4; width: 24px; height: 24px; padding: 0; border: 0; background: transparent; transform: translate(-50%, -50%); touch-action: none; user-select: none; }
.portfolio-block-resize::after { content: ""; position: absolute; inset: 7px; border: 1.5px solid var(--theme-accent); border-radius: 2px; background: var(--theme-surface); }
.portfolio-resize-nw { left: -7px; top: -7px; cursor: nwse-resize; }
.portfolio-resize-n { left: 50%; top: -7px; cursor: ns-resize; }
.portfolio-resize-ne { left: calc(100% + 7px); top: -7px; cursor: nesw-resize; }
.portfolio-resize-e { left: calc(100% + 7px); top: 50%; cursor: ew-resize; }
.portfolio-resize-se { left: calc(100% + 7px); top: calc(100% + 7px); cursor: nwse-resize; }
.portfolio-resize-s { left: 50%; top: calc(100% + 7px); cursor: ns-resize; }
.portfolio-resize-sw { left: -7px; top: calc(100% + 7px); cursor: nesw-resize; }
.portfolio-resize-w { left: -7px; top: 50%; cursor: ew-resize; }
.portfolio-block-image img { max-width: 100%; display: block; height: auto; }
.portfolio-block-fixed-height.portfolio-block-image .markdown-content, .portfolio-block-fixed-height.portfolio-block-image .markdown-content > p { height: 100%; }
.portfolio-block-image .markdown-content > p { margin: 0; line-height: 0; }
.portfolio-block-fixed-height.portfolio-block-image img { width: 100%; height: 100%; object-fit: contain; display: block; margin: 0 !important; }
@container portfolio-document (max-width: 600px) {
  .portfolio-document:not(.portfolio-document-editable) .portfolio-document-free { display: flex; flex-direction: column; gap: 28px; height: auto !important; min-height: 0; }
  .portfolio-document:not(.portfolio-document-editable) .portfolio-document-free > .portfolio-document-block { position: static !important; inset: auto !important; width: 100% !important; height: auto !important; }
}
.portfolio-document .portfolio-formatted-content :is(p, h1, h2, h3, ul, ol, blockquote, pre, table) { margin: 0 0 1em; }
.portfolio-document .portfolio-formatted-content :is(p, h1, h2, h3, ul, ol, blockquote, pre, table):last-child { margin-bottom: 0; }
.portfolio-document .portfolio-formatted-content :is(h1, h2, h3) { color: inherit; font-weight: 700; line-height: 1.35; letter-spacing: -.025em; }
.portfolio-document .portfolio-formatted-content h1 { font-size: 32px; }
.portfolio-document .portfolio-formatted-content h2 { font-size: 26px; }
.portfolio-document .portfolio-formatted-content h3 { font-size: 21px; }
.portfolio-document .portfolio-formatted-content :is(ul, ol) { padding-left: 1.6em; }
.portfolio-document .portfolio-formatted-content ul { list-style: disc; }
.portfolio-document .portfolio-formatted-content ol { list-style: decimal; }
.portfolio-document .portfolio-formatted-content blockquote { padding-left: 16px; border-left: 3px solid var(--theme-border); color: var(--theme-muted); }
.portfolio-document .portfolio-formatted-content code { padding: .15em .3em; border-radius: 3px; background: var(--theme-raised); font: .9em/1.6 ui-monospace, monospace; }
.portfolio-document .portfolio-formatted-content pre { padding: 16px; border-radius: 6px; background: var(--theme-raised); overflow: auto; }
.portfolio-document .portfolio-formatted-content pre code { padding: 0; }
.portfolio-document .portfolio-formatted-content table { width: 100%; border-collapse: collapse; }
.portfolio-document .portfolio-formatted-content :is(td, th) { border: 1px solid var(--theme-border); padding: 6px 10px; text-align: left; }
.portfolio-document .portfolio-formatted-content img { max-width: 100%; height: auto; }
.portfolio-code-block { margin: 0 0 1em; border-radius: 6px; overflow: hidden; background: var(--theme-raised); text-align: left; }
.portfolio-code-bar { display: flex; align-items: center; min-height: 34px; padding: 4px 12px; border-bottom: 1px solid var(--theme-border); color: var(--theme-muted); font: 12px/1.5 sans-serif; }
.portfolio-code-bar select { max-width: 180px; padding: 3px 22px 3px 0; border: 0; background: transparent; color: inherit; font: inherit; cursor: pointer; }
.portfolio-code-block pre { margin: 0; border-radius: 0; }
.portfolio-document .portfolio-formatted-content :is(.markdown-content, .tiptap) { font-size: inherit; line-height: inherit; font-family: inherit; letter-spacing: inherit; }
.portfolio-document .portfolio-formatted-content :is(p, h1, h2, h3, li) { max-width: none; white-space: pre-wrap; }
.portfolio-document .portfolio-formatted-content li { margin: 0; padding: 0; }
.portfolio-document .portfolio-formatted-content strong { font-weight: 700; }
.portfolio-document .portfolio-formatted-content blockquote { padding: 0 0 0 16px; border-radius: 0; background: transparent; }
.portfolio-document .portfolio-formatted-content pre { border: 0; font-size: inherit; line-height: inherit; }
.portfolio-document .portfolio-formatted-content pre code { font: .9em/1.6 ui-monospace, monospace; background: transparent; white-space: pre; }
.portfolio-document .portfolio-formatted-content table { display: table; font-size: inherit; table-layout: auto; }
.portfolio-document .portfolio-formatted-content :is(td, th) { min-width: 0; }
.portfolio-document .portfolio-formatted-content a { color: var(--theme-accent); text-decoration: underline; font-weight: inherit; }
</style>
