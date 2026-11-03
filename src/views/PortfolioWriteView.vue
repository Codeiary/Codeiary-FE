<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import BrandLogo from "@/components/BrandLogo.vue";
import ThemeToggle from "@/components/ThemeToggle.vue";
import Icon from "@/components/Icon.vue";
import EditorIcon from "@/components/blog/EditorIcon.vue";
import PortfolioBlocksEditor from "@/components/portfolio/PortfolioBlocksEditor.vue";
import PortfolioTextAlignment from "@/components/portfolio/PortfolioTextAlignment.vue";
import PortfolioDocument from "@/components/portfolio/PortfolioDocument.vue";
import PortfolioPdfButton from "@/components/portfolio/PortfolioPdfButton.vue";
import { auth } from "@/store/auth";
import { portfolios } from "@/store/portfolio";
import { createPortfolio, fetchPortfolioFonts } from "@/services/portfolio-api";
import { measurePortfolioBlocks, portfolioPayload } from "@/utils/portfolio/api-payload";
import {
  blocksFromMarkdown, blocksToMarkdown, createPortfolioBlock,
  PORTFOLIO_TITLE_ID, type PortfolioBlock, type PortfolioBlockType, type PortfolioTextRun,
} from "@/utils/portfolio/layout";
import "@/assets/styles/writer.css";
import "@/assets/styles/content-window.css";

const route = useRoute();
const router = useRouter();
const user = computed(() => auth.user.value);
const existing = computed(() => portfolios.value.find((item) => item.id === Number(route.query.id)));
const draft = reactive({
  title: "",
  titleRuns: [] as PortfolioTextRun[],
  titleAlign: "left" as "left" | "center" | "right",
  coverImage: undefined as string | undefined,
  blocks: [] as PortfolioBlock[],
  visibility: "PUBLIC" as "PUBLIC" | "PRIVATE",
});
const loading = ref(true);
const saving = ref(false);
const uploading = ref(false);
const error = ref("");
const inspector = ref<"design" | "page">("page");
const selectedId = ref("");
const previewOnly = ref(false);
const imageInput = ref<HTMLInputElement>();
const coverInput = ref<HTMLInputElement>();
const canvas = ref<HTMLElement>();
let uploadTarget = "";
const canEdit = computed(() => !!user.value && (!route.query.id || existing.value?.author.id === user.value.id));
const busy = computed(() => saving.value || uploading.value || !canEdit.value);
const blockTypes: { type: PortfolioBlockType; label: string; icon?: string; text?: string }[] = [
  { type: "text", label: "텍스트", text: "T" },
  { type: "image", label: "이미지", icon: "image" },
];
const previewPost = computed(() => ({
  title: draft.title,
  category: "", tags: [],
  author: { id: user.value?.id ?? 0, name: user.value?.nickname || user.value?.name || "Codeiary" },
  date: "",
  content: blocksToMarkdown(draft.blocks),
  visibility: draft.visibility,
  coverImage: draft.coverImage,
  imageLayouts: {},
}));

function selectBlock(id: string) {
  selectedId.value = id;
  inspector.value = "design";
}
function addBlock(type: PortfolioBlockType) {
  if (busy.value) return;
  if (type === "image") { requestImage(""); return; }
  insertBlock(type);
}
function insertBlock(type: PortfolioBlockType, values: Partial<PortfolioBlock> = {}) {
  const block = createPortfolioBlock(type, values);
  if (draft.blocks.every((item) => item.position)) {
    const elements = canvas.value?.querySelectorAll<HTMLElement>(".portfolio-document-block") ?? [];
    const bottom = Math.max(0, ...Array.from(elements, (element) => element.offsetTop + element.offsetHeight));
    block.position = { x: 4, y: bottom ? bottom + 28 : 12, width: type === "image" ? 60 : 80 };
  }
  const selected = draft.blocks.findIndex((item) => item.id === selectedId.value);
  const position = selected < 0 ? draft.blocks.length : selected + 1;
  draft.blocks.splice(position, 0, block);
  selectBlock(block.id);
}
function updateBlock(id: string, patch: Partial<PortfolioBlock>) {
  if (busy.value) return;
  const block = draft.blocks.find((item) => item.id === id);
  if (block) Object.assign(block, patch);
}
function updateBlocks(blocks: PortfolioBlock[]) {
  draft.blocks = blocks;
  if (!blocks.some((item) => item.id === selectedId.value)) selectedId.value = blocks[0]?.id ?? "";
}
function requestImage(id: string) {
  uploadTarget = id;
  imageInput.value?.click();
}
async function uploadImage(event: Event, cover = false) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  const targetId = uploadTarget;
  input.value = "";
  if (!file || busy.value) return;
  uploading.value = true;
  error.value = "";
  try {
    const url = await auth.uploadBlogImage(file);
    if (cover) draft.coverImage = url;
    else {
      const block = draft.blocks.find((item) => item.id === targetId);
      if (block) {
        block.imageUrl = url;
        if (block.position) block.position = { ...block.position, height: undefined };
        if (!block.alt) block.alt = file.name.replace(/\.[^.]+$/, "");
      } else if (canEdit.value) insertBlock("image", { imageUrl: url, alt: file.name.replace(/\.[^.]+$/, "") });
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "이미지를 추가하지 못했어요.";
  } finally {
    uploading.value = false;
  }
}
// Keep a bounded editing history for text and layout changes.
const history = ref<string[]>([]);
const historyIndex = ref(-1);
let restoring = false;
const snapshot = () => JSON.stringify(draft);
const savedSnapshot = ref("");
const dirty = computed(() => !loading.value && snapshot() !== savedSnapshot.value);
function exit() { return router.push({ name: "user-home", query: { tab: "portfolio" } }); }
function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value && !uploading.value) return;
  event.preventDefault();
  event.returnValue = "";
}
onBeforeRouteLeave(() => {
  if (uploading.value) { error.value = "이미지 업로드가 끝난 후 이동해 주세요."; return false; }
  return !canEdit.value || !dirty.value || window.confirm("저장하지 않은 변경 사항이 있어요. 저장하지 않고 나갈까요?");
});
watch(draft, () => {
  if (loading.value || restoring) return;
  const value = snapshot();
  if (history.value[historyIndex.value] === value) return;
  history.value = history.value.slice(0, historyIndex.value + 1);
  history.value.push(value);
  if (history.value.length > 60) history.value.shift();
  historyIndex.value = history.value.length - 1;
}, { deep: true });
async function restoreHistory(direction: -1 | 1) {
  const index = historyIndex.value + direction;
  if (busy.value || index < 0 || index >= history.value.length) return;
  restoring = true;
  historyIndex.value = index;
  Object.assign(draft, JSON.parse(history.value[index]!));
  if (!draft.blocks.some((block) => block.id === selectedId.value)) selectedId.value = draft.blocks[0]?.id ?? "";
  await nextTick();
  restoring = false;
}
function keyboardSave(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    void save();
  }
}
async function save() {
  const owner = user.value;
  if (busy.value || !owner) return;
  error.value = "";
  if (existing.value) {
    error.value = "현재는 새 포트폴리오 저장만 가능해요.";
    return;
  }
  if (!draft.title.trim()) {
    error.value = "제목을 입력해 주세요.";
    previewOnly.value = false;
    selectBlock(PORTFOLIO_TITLE_ID);
    await nextTick();
    canvas.value?.querySelector<HTMLElement>('[aria-label="포트폴리오 제목 직접 편집"]')?.focus();
    return;
  }
  const incomplete = draft.blocks.find((block) =>
    block.type === "image" && !block.imageUrl);
  if (incomplete) {
    error.value = "이미지 블록에 이미지를 추가해 주세요.";
    previewOnly.value = false;
    selectBlock(incomplete.id);
    return;
  }
  const content = blocksToMarkdown(draft.blocks);
  if (!draft.blocks.length) {
    error.value = "텍스트나 이미지를 추가해 주세요.";
    return;
  }
  saving.value = true;
  try {
    previewOnly.value = false;
    await nextTick();
    const [fonts, layouts] = await Promise.all([
      fetchPortfolioFonts(), measurePortfolioBlocks(canvas.value!, draft.blocks),
    ]);
    const input = portfolioPayload(draft, fonts, layouts);
    const data = {
      title: draft.title, titleRuns: draft.titleRuns.map((run) => ({ ...run })), titleAlign: draft.titleAlign, content,
      summary: content.replace(/[#>*`_~\[\]()!|\\-]/g, " ").replace(/\s+/g, " ").slice(0, 140),
      coverImage: draft.coverImage,
      blocks: draft.blocks.map((block) => ({ ...block })),
      visibility: draft.visibility,
    };
    const { id } = await createPortfolio(input);
    portfolios.value.unshift({ ...data, id, author: { id: owner.id, name: owner.nickname || owner.name } });
    savedSnapshot.value = snapshot();
    await router.push({ name: "portfolio", query: { portfolioId: String(id) } });
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "포트폴리오를 저장하지 못했어요. 다시 시도해 주세요.";
  } finally {
    saving.value = false;
  }
}
onMounted(() => {
  if (!user.value) error.value = "포트폴리오를 작성하려면 로그인해 주세요.";
  else if (route.query.id && !existing.value) error.value = "수정할 포트폴리오를 찾지 못했어요.";
  else if (!canEdit.value) error.value = "내가 작성한 포트폴리오만 수정할 수 있어요.";
  else if (existing.value) {
    Object.assign(draft, {
      title: existing.value.title, titleRuns: existing.value.titleRuns?.map((run) => ({ ...run })) ?? [], titleAlign: existing.value.titleAlign ?? "left", coverImage: existing.value.coverImage,
      blocks: existing.value.blocks?.map((block) => ({ ...block })) ?? blocksFromMarkdown(existing.value.content),
      visibility: existing.value.visibility,
    });
  }
  selectedId.value = draft.blocks[0]?.id ?? PORTFOLIO_TITLE_ID;
  if (existing.value) inspector.value = "design";
  history.value = [snapshot()];
  historyIndex.value = 0;
  savedSnapshot.value = snapshot();
  loading.value = false;
  window.addEventListener("keydown", keyboardSave);
  window.addEventListener("beforeunload", beforeUnload);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", keyboardSave);
  window.removeEventListener("beforeunload", beforeUnload);
});
</script>

<template>
  <div class="portfolio-studio" :class="{ 'is-preview': previewOnly }">
    <header class="writer-header">
      <button class="brand" aria-label="마이페이지로 돌아가기" @click="exit"><BrandLogo /></button>
      <span class="writer-header-label">포트폴리오</span>
      <div class="writer-header-utilities">
      <div class="portfolio-studio-history">
        <button aria-label="실행 취소" title="실행 취소" :disabled="historyIndex <= 0 || busy" @click="restoreHistory(-1)"><EditorIcon name="undo" /></button>
        <button aria-label="다시 실행" title="다시 실행" :disabled="historyIndex >= history.length - 1 || busy" @click="restoreHistory(1)"><EditorIcon name="redo" /></button>
      </div>
        <ThemeToggle />
        <button class="writer-exit" aria-label="나가기" title="나가기" :disabled="saving || uploading" @click="exit"><Icon name="close" :size="18" /></button>
      </div>
      <div class="writer-header-actions">
        <button class="writer-preview-toggle" :aria-label="previewOnly ? '작성' : '미리보기'" :aria-pressed="previewOnly" @click="previewOnly = !previewOnly"><Icon :name="previewOnly ? 'case' : 'eye'" :size="17" /><span>{{ previewOnly ? '작성' : '미리보기' }}</span></button>
        <label class="writer-visibility"><Icon :name="draft.visibility === 'PRIVATE' ? 'lock' : 'eye'" :size="14" /><select v-model="draft.visibility" aria-label="포트폴리오 공개 설정" :disabled="busy"><option value="PUBLIC">공개</option><option value="PRIVATE">비공개</option></select></label>
        <button class="writer-publish" :disabled="loading || busy" @click="save">{{ saving ? '저장 중…' : '저장' }}</button>
      </div>
    </header>
    <main v-if="loading" class="writer-load" role="status">편집기를 준비하고 있어요.</main>
    <main v-else class="portfolio-studio-workspace">
      <nav v-if="!previewOnly" class="portfolio-studio-tools" aria-label="포트폴리오 요소 추가">
        <button v-for="item in blockTypes" :key="item.type" :aria-label="`${item.label} 블록 추가`" :disabled="busy" @click="addBlock(item.type)"><span v-if="item.text" class="portfolio-type-icon">{{ item.text }}</span><EditorIcon v-else :name="item.icon!" /><span>{{ item.label }}</span></button>
      </nav>
      <section class="portfolio-studio-canvas-column" aria-label="포트폴리오 캔버스">
        <div class="portfolio-canvas-scroll">
          <div ref="canvas" class="portfolio-canvas-page" :class="{ 'is-empty': !draft.blocks.length }">
            <PortfolioDocument :post="previewPost" :title-runs="draft.titleRuns" :title-align="draft.titleAlign" :blocks="draft.blocks" :editable="!previewOnly && canEdit && !saving" :selected-block="selectedId" toolbar-target="#portfolio-text-tools" @update:title="draft.title = $event" @update:title-runs="draft.titleRuns = $event" @update-block="updateBlock" @select-block="selectBlock" />
            <div v-if="!draft.blocks.length && !previewOnly" class="portfolio-canvas-empty">
              <button class="portfolio-empty-mark" aria-label="텍스트 추가" :disabled="busy" @click="addBlock('text')"><Icon name="plus" :size="28" /></button>
            </div>
          </div>
        </div>
        <footer class="portfolio-canvas-status" aria-hidden="true"></footer>
      </section>
      <aside v-if="!previewOnly" class="portfolio-studio-inspector" aria-label="포트폴리오 편집 설정">
        <div class="portfolio-inspector-tabs" role="group" aria-label="편집 설정 선택">
          <button :aria-pressed="inspector === 'design'" @click="inspector = 'design'">디자인</button>
          <button :aria-pressed="inspector === 'page'" @click="inspector = 'page'">페이지</button>
        </div>
        <div class="portfolio-inspector-scroll">
          <div v-show="inspector === 'design'">
            <div id="portfolio-text-tools"></div>
            <div v-if="selectedId === PORTFOLIO_TITLE_ID" class="portfolio-title-align"><PortfolioTextAlignment v-model="draft.titleAlign" :disabled="busy" title /></div>
            <PortfolioBlocksEditor v-if="draft.blocks.length && selectedId !== PORTFOLIO_TITLE_ID" :model-value="draft.blocks" :selected-id="selectedId" :disabled="busy" @update:model-value="updateBlocks" @select="selectBlock" @upload-image="requestImage" />
            <p v-else-if="selectedId !== PORTFOLIO_TITLE_ID" class="portfolio-inspector-hint">본문에서 텍스트나 이미지를 선택하세요.</p>
          </div>
          <div v-show="inspector === 'page'">
          <section class="portfolio-inspector-section" aria-label="페이지 정보">
            <h2>페이지 정보</h2>
            <div class="portfolio-page-settings">
            <div class="portfolio-cover-setting"><span>대표 이미지</span><img v-if="draft.coverImage" :src="draft.coverImage" alt="선택한 대표 이미지" /><button :disabled="busy" @click="coverInput?.click()"><EditorIcon name="image" />{{ draft.coverImage ? '이미지 변경' : '이미지 추가' }}</button><button v-if="draft.coverImage" :disabled="busy" @click="draft.coverImage = undefined">삭제</button></div>
            </div>
          </section>
          <div v-if="canEdit" class="portfolio-export-section">
            <PortfolioPdfButton :post="previewPost" :title-runs="draft.titleRuns" :title-align="draft.titleAlign" :blocks="draft.blocks" :disabled="busy" />
          </div>
          </div>
        </div>
      </aside>
    </main>
    <p v-if="error" class="portfolio-studio-error" role="alert">{{ error }}<button aria-label="오류 닫기" @click="error = ''"><Icon name="close" :size="16" /></button></p>
    <input ref="imageInput" class="writer-hidden-input" type="file" accept="image/jpeg,image/png" @change="uploadImage($event)" />
    <input ref="coverInput" class="writer-hidden-input" type="file" accept="image/jpeg,image/png" @change="uploadImage($event, true)" />
  </div>
</template>

<style scoped>
.portfolio-studio { height: 100vh; height: 100dvh; display: flex; flex-direction: column; overflow: hidden; background: var(--theme-surface); color: var(--theme-text); }
.portfolio-studio-history { display: flex; align-items: center; gap: 9px; }
.portfolio-studio-history button { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 7px; }
.portfolio-studio button:disabled { opacity: .4; cursor: not-allowed; }
.portfolio-studio button:focus-visible { outline: 2px solid var(--theme-accent); outline-offset: 3px; }
.portfolio-studio-workspace { display: grid; grid-template-columns: 76px minmax(0, 1fr) 320px; flex: 1; min-height: 0; }
.portfolio-studio.is-preview .portfolio-studio-workspace { grid-template-columns: minmax(0, 1fr); }
.portfolio-studio-tools { display: flex; flex-direction: column; align-items: stretch; gap: 5px; padding: 14px 7px; border-right: 1px solid var(--theme-border); overflow: auto; }
.portfolio-studio-tools button { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; min-height: 58px; padding: 8px 4px; border-radius: 9px; font-size: 11px; color: var(--theme-muted); }
.portfolio-studio-tools button:hover, .portfolio-studio-tools button[aria-pressed='true'] { color: var(--theme-accent); background: var(--theme-raised); }
.portfolio-type-icon { font: 650 22px/22px Georgia, serif; }
.portfolio-studio-canvas-column { min-width: 0; min-height: 0; display: flex; flex-direction: column; background: var(--theme-raised); }
.portfolio-canvas-scroll { flex: 1; min-height: 0; overflow: auto; padding: 32px 28px 56px; background-image: radial-gradient(var(--theme-border) .8px, transparent .8px); background-size: 16px 16px; }
.portfolio-canvas-page { position: relative; width: var(--portfolio-page-width); min-height: var(--portfolio-page-height); margin: 0 auto; }
.portfolio-canvas-page :deep(.portfolio-document) { min-height: var(--portfolio-page-height); box-shadow: 0 5px 26px #16221b0d; }
.portfolio-canvas-empty { position: absolute; top: 180px; left: 36px; right: 36px; text-align: center; color: var(--theme-muted); }
.portfolio-empty-mark { display: inline-grid; place-items: center; width: 56px; height: 56px; border: 1px dashed var(--theme-border); border-radius: 12px; color: var(--theme-accent); background: transparent; }
.portfolio-empty-mark:hover { border-color: var(--theme-accent); }
.portfolio-canvas-status { min-height: 36px; border-top: 1px solid var(--theme-border); }
.portfolio-studio-inspector { display: flex; flex-direction: column; min-width: 0; min-height: 0; border-left: 1px solid var(--theme-border); }
.portfolio-inspector-hint { color: var(--theme-muted); font-size: 12px; line-height: 1.7; }
.portfolio-title-align { margin-top: 18px; padding-top: 15px; border-top: 1px solid var(--theme-border); }
.portfolio-inspector-section { padding-top: 2px; }
.portfolio-inspector-section > h2 { margin: 0 0 20px; font-size: 13px; font-weight: 650; }
.portfolio-inspector-tabs { display: flex; gap: 4px; min-height: 45px; align-items: center; padding: 5px 12px; border-bottom: 1px solid var(--theme-border); }
.portfolio-inspector-tabs button { flex: 1; border-radius: 5px; padding: 7px; color: var(--theme-muted); font-size: 12px; }
.portfolio-inspector-tabs button[aria-pressed='true'] { color: var(--theme-text); background: var(--theme-raised); font-weight: 650; }
.portfolio-inspector-scroll { flex: 1; overflow: auto; min-height: 0; padding: 18px 16px; }
.portfolio-export-section { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--theme-border); }
.portfolio-export-section :deep(.portfolio-pdf-button) { width: 100%; min-height: 40px; border: 1px solid var(--theme-border); background: var(--theme-raised); color: var(--theme-text); }
.portfolio-export-section :deep(.portfolio-pdf-button:hover) { border-color: var(--theme-muted); }
.portfolio-page-settings { display: grid; gap: 22px; }
.portfolio-cover-setting { display: grid; gap: 10px; font-size: 12px; color: var(--theme-muted); }
.portfolio-cover-setting img { width: 100%; max-height: 150px; object-fit: cover; border-radius: 7px; }
.portfolio-cover-setting button { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 36px; border: 1px solid var(--theme-border); border-radius: 7px; }
.portfolio-studio-error { position: fixed; z-index: 80; bottom: 28px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 20px; width: max-content; max-width: calc(100vw - 32px); padding: 13px 16px; background: var(--theme-text); color: var(--theme-surface); border-radius: 9px; box-shadow: 0 6px 24px #0002; font-size: 13px; }
@media (max-width: 1100px) { .portfolio-studio-workspace { grid-template-columns: 64px minmax(0, 1fr) 285px; } .portfolio-canvas-scroll { padding: 22px 16px 40px; } }
@media (max-width: 760px) {
  .portfolio-studio-history { gap: 0; }
  .portfolio-studio-workspace { grid-template-columns: minmax(0, 1fr); grid-template-rows: 64px minmax(160px, 1fr) minmax(180px, 38vh); }
  .portfolio-studio.is-preview .portfolio-studio-workspace { grid-template-rows: minmax(0, 1fr); }
  .portfolio-studio-tools { flex-direction: row; padding: 4px 8px; gap: 2px; border-right: 0; border-bottom: 1px solid var(--theme-border); }
  .portfolio-studio-tools button { flex: 1; flex-shrink: 0; min-width: 42px; min-height: 52px; font-size: 10px; gap: 4px; }
  .portfolio-canvas-scroll { padding: 14px 12px 25px; }
  .portfolio-canvas-status { display: none; }
  .portfolio-studio-inspector { border-left: 0; border-top: 1px solid var(--theme-border); }
  .portfolio-inspector-tabs { min-height: 38px; }
}
@media (max-width: 400px) { .writer-header-label { display: none; } }
</style>
