<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import BrandLogo from "@/components/BrandLogo.vue";
import ThemeToggle from "@/components/ThemeToggle.vue";
import Icon from "@/components/Icon.vue";
import EditorIcon from "@/components/blog/EditorIcon.vue";
import MarkdownEditor from "@/components/blog/MarkdownEditor.vue";
import PostArticle from "@/components/blog/PostArticle.vue";
import CoverImage from "@/components/blog/CoverImage.vue";
import { auth } from "@/store/auth";
import { authorSlug } from "@/utils/blog/slug";
import {
  addImage,
  createDraft,
  readDraft,
  saveDraft,
  type BlogDraft,
} from "@/services/blog-storage";
import { loadLocalPosts, localPosts, publishDraft } from "@/store/blog";
import type { EditorAction } from "@/utils/blog/editor-commands";
import {
  normalizeImageLayout,
  type ImageLayout,
  type SelectedImage,
  type ImageAlignment,
} from "@/utils/blog/image-layout";
import "@/assets/styles/writer.css";

const route = useRoute();
const router = useRouter();
const owner = auth.user.value;
const draft = reactive<BlogDraft>(createDraft(owner ?? { id: 0, name: "" }));
const loading = ref(true);
const loadError = ref("");
const error = ref("");
const tagInput = ref("");
const mode = ref<"split" | "write" | "preview">("split");
const compactScreen = window.matchMedia("(max-width: 760px)");
function syncScreenMode() {
  if (compactScreen.matches && mode.value === "split") mode.value = "write";
  if (!compactScreen.matches && mode.value === "write") mode.value = "split";
}
function showWriting() {
  mode.value = compactScreen.matches ? "write" : "split";
}
const editor = ref<InstanceType<typeof MarkdownEditor>>();
const fileInput = ref<HTMLInputElement>();
const coverInput = ref<HTMLInputElement>();
const titleInput = ref<HTMLTextAreaElement>();
const categoryInput = ref<HTMLInputElement>();
const linkDialog = ref<HTMLDialogElement>();
const linkLabel = ref("");
const linkUrl = ref("");
const linkError = ref("");
const selectedImage = ref<SelectedImage>();
const previewPane = ref<HTMLElement>();
let scrollFrame = 0;
let restoreFrame = 0;
let restoringScroll = false;
const expectedScroll = new WeakMap<HTMLElement, number>();
const scrollPositions = {
  split: { source: 0, preview: 0 },
  write: { source: 0, preview: 0 },
  preview: { source: 0, preview: 0 },
};
function setScroll(element: HTMLElement | undefined, top: number) {
  if (!element) return;
  const target = Math.max(
    0,
    Math.min(top, element.scrollHeight - element.clientHeight),
  );
  expectedScroll.set(element, target);
  element.scrollTop = target;
}
function syncScroll(from: "source" | "preview") {
  if (mode.value !== "split" || restoringScroll) return;
  const source = editor.value?.scrollElement();
  const preview = previewPane.value;
  if (!source || !preview) return;
  const origin = from === "source" ? source : preview;
  const target = from === "source" ? preview : source;
  const expected = expectedScroll.get(origin);
  expectedScroll.delete(origin);
  if (expected !== undefined && Math.abs(origin.scrollTop - expected) < 2)
    return;
  const range = origin.scrollHeight - origin.clientHeight;
  if (range <= 0) return;
  const progress = Math.max(0, Math.min(1, origin.scrollTop / range));
  cancelAnimationFrame(scrollFrame);
  scrollFrame = requestAnimationFrame(() => {
    if (mode.value !== "split" || restoringScroll) return;
    setScroll(target, progress * (target.scrollHeight - target.clientHeight));
    // CodeMirror measures wrapped lines after moving its virtual viewport.
    // Apply the same position once more against the measured height.
    if (from === "preview")
      scrollFrame = requestAnimationFrame(() => {
        if (mode.value === "split" && !restoringScroll)
          setScroll(
            target,
            progress * (target.scrollHeight - target.clientHeight),
          );
      });
  });
}
const alignments: { value: ImageAlignment; label: string }[] = [
  { value: "left", label: "왼쪽 정렬" },
  { value: "center", label: "가운데 정렬" },
  { value: "right", label: "오른쪽 정렬" },
];
const dirty = ref(false);
const saving = ref(0);
const uploading = ref(false);
const publishing = ref(false);
let complete = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let saveQueue: Promise<void> = Promise.resolve();
const previewPost = computed(() => ({
  title: draft.title.trim() || "제목을 입력하세요",
  category: draft.category.trim(),
  tags: draft.tags,
  author: draft.author,
  date:
    localPosts.value.find((post) => post.id === draft.postId)?.date ??
    new Date().toLocaleDateString("sv-SE").replace(/-/g, "."),
  content: draft.content,
  visibility: draft.visibility,
  coverImage: draft.coverImage,
  imageLayouts: draft.imageLayouts,
}));
const tools: {
  action: EditorAction;
  label: string;
  text?: string;
  group?: boolean;
}[] = [
  { action: "h1", label: "제목 1", text: "H₁" },
  { action: "h2", label: "제목 2", text: "H₂" },
  { action: "h3", label: "제목 3", text: "H₃" },
  { action: "bold", label: "굵게 (⌘/Ctrl+B)", group: true },
  { action: "italic", label: "기울임 (⌘/Ctrl+I)" },
  { action: "strike", label: "취소선" },
  { action: "quote", label: "인용문", group: true },
  { action: "bullet", label: "글머리 목록" },
  { action: "numbered", label: "번호 목록" },
  { action: "code", label: "코드 블록", group: true },
  { action: "table", label: "표" },
  { action: "math", label: "문장 안 수식" },
  { action: "divider", label: "구분선" },
];
function snapshot() {
  return {
    ...draft,
    category: draft.category.trim(),
    author: { ...draft.author },
    tags: [...draft.tags],
    imageLayouts: Object.fromEntries(
      Object.entries(draft.imageLayouts ?? {}).map(([key, layout]) => [
        key,
        { ...layout },
      ]),
    ),
    updatedAt: new Date().toISOString(),
  };
}
function fingerprint() {
  return JSON.stringify([
    draft.title,
    draft.content,
    draft.category,
    draft.tags,
    draft.imageLayouts,
    draft.coverImage,
    draft.visibility,
  ]);
}
function resizeTitle() {
  if (!titleInput.value) return;
  titleInput.value.style.height = "auto";
  titleInput.value.style.height = `${titleInput.value.scrollHeight}px`;
}
function addTags() {
  const values = tagInput.value
    .split(",")
    .map((tag) => tag.trim().replace(/^#+/, ""))
    .filter(Boolean);
  if (!values.length) {
    tagInput.value = "";
    return;
  }
  const unique = [...draft.tags];
  for (const value of values) {
    if (value.length > 30) {
      error.value = "태그는 30자 이내로 입력해 주세요.";
      return;
    }
    if (
      !unique.some(
        (tag) => tag.toLocaleLowerCase() === value.toLocaleLowerCase(),
      )
    )
      unique.push(value);
  }
  if (unique.length > 10) {
    error.value = "태그는 최대 10개까지 달 수 있어요.";
    return;
  }
  draft.tags = unique;
  tagInput.value = "";
  error.value = "";
}
function tagKeydown(event: KeyboardEvent) {
  if (event.isComposing) return;
  if (event.key === "Enter" || event.key === ",") {
    event.preventDefault();
    addTags();
  }
  if (event.key === "Backspace" && !tagInput.value) draft.tags.pop();
}
async function persist(updateAddress = true) {
  clearTimeout(timer);
  if (loading.value || complete) return;
  const version = fingerprint();
  const data = snapshot();
  saving.value++;
  const pending = saveQueue.catch(() => {}).then(() => saveDraft(data));
  saveQueue = pending;
  try {
    await pending;
    if (version === fingerprint()) dirty.value = false;
    if (updateAddress && route.name === "blog-write" && !route.params.draftId) {
      await router.replace({
        name: "blog-write",
        params: { draftId: draft.id },
      });
    }
  } finally {
    saving.value--;
  }
}
async function saveNow() {
  if (publishing.value || uploading.value) return;
  error.value = "";
  addTags();
  if (error.value) return;
  try {
    await persist();
  } catch {
    error.value =
      "작성 내용을 보관하지 못했어요. 브라우저 저장 공간을 확인해 주세요.";
  }
}
watch(fingerprint, () => {
  if (loading.value || complete || publishing.value) return;
  dirty.value = true;
  clearTimeout(timer);
  timer = setTimeout(() => {
    void persist().catch(() => {
      error.value =
        "자동 복구 저장에 실패했어요. 내용을 복사해 두고 다시 시도해 주세요.";
    });
  }, 900);
});
watch(mode, async (current, previous) => {
  scrollPositions[previous] = {
    source: editor.value?.scrollElement()?.scrollTop ?? 0,
    preview: previewPane.value?.scrollTop ?? 0,
  };
  restoringScroll = true;
  cancelAnimationFrame(scrollFrame);
  cancelAnimationFrame(restoreFrame);
  await nextTick();
  resizeTitle();
  restoreFrame = requestAnimationFrame(() => {
    setScroll(editor.value?.scrollElement(), scrollPositions[current].source);
    setScroll(previewPane.value, scrollPositions[current].preview);
    restoringScroll = false;
  });
});
watch(
  () => draft.title,
  () => nextTick(resizeTitle),
);
function format(action: EditorAction) {
  if (mode.value === "preview") showWriting();
  nextTick(() => editor.value?.format(action));
}
async function editImage(image: SelectedImage) {
  if (publishing.value) return;
  selectedImage.value = image;
  if (mode.value === "write")
    mode.value = compactScreen.matches ? "preview" : "split";
  await nextTick();
  previewPane.value
    ?.querySelector('.markdown-editable-image[aria-pressed="true"]')
    ?.scrollIntoView({ block: "nearest" });
}
function updateImageLayout(change: Partial<ImageLayout>) {
  if (!selectedImage.value || publishing.value) return;
  const layout = normalizeImageLayout({
    ...selectedImage.value,
    ...change,
    ...(change.width !== undefined ? { original: false } : {}),
  });
  draft.imageLayouts = {
    ...draft.imageLayouts,
    [selectedImage.value.key]: layout,
  };
  selectedImage.value = { ...selectedImage.value, ...layout };
}
watch(
  () => draft.content,
  () => {
    selectedImage.value = undefined;
  },
);
function openLink() {
  linkLabel.value = editor.value?.selectedText() ?? "";
  linkUrl.value = "";
  linkError.value = "";
  linkDialog.value?.showModal();
}
function insertLink() {
  let url: URL;
  try {
    url = new URL(linkUrl.value.trim());
  } catch {
    linkError.value = "https://로 시작하는 올바른 주소를 입력해 주세요.";
    return;
  }
  if (!["https:", "http:", "mailto:"].includes(url.protocol)) {
    linkError.value = "웹사이트 또는 이메일 주소만 넣을 수 있어요.";
    return;
  }
  const text = (linkLabel.value.trim() || url.hostname || "링크").replace(
    /[\[\]\\\n]/g,
    "",
  );
  linkDialog.value?.close();
  if (mode.value === "preview") showWriting();
  nextTick(() =>
    editor.value?.insert(`[${text}](<${url.href.replace(/>/g, "%3E")}>)`),
  );
}
async function insertImages(files: File[]) {
  if (uploading.value || !files.length) return;
  uploading.value = true;
  error.value = "";
  let lastImage: SelectedImage | undefined;
  const inserted: string[] = [];
  try {
    // Saving first ensures uploaded assets belong to a recoverable draft.
    await persist();
    for (const file of files) {
      const src = await addImage(file, snapshot());
      const alt =
        file.name.replace(/\.[^.]+$/, "").replace(/[\[\]\\\n]/g, "") ||
        "이미지";
      inserted.push(`![${alt}](${src})`);
      lastImage = {
        key: JSON.stringify([src, 0]),
        alt,
        width: 100,
        align: "center",
      };
    }
    if (mode.value === "preview") showWriting();
    await nextTick();
    editor.value?.insert(inserted.join(" "), true);
    await persist();
    if (lastImage)
      await editImage({
        ...lastImage,
        width: Math.round(100 / inserted.length),
        original: inserted.length === 1,
        rowSize: inserted.length > 1 ? inserted.length : undefined,
      });
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : "이미지를 저장하지 못했어요.";
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = "";
  }
}
function chooseFiles(event: Event) {
  void insertImages(Array.from((event.target as HTMLInputElement).files ?? []));
}
async function chooseCover(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || uploading.value || publishing.value) return;
  uploading.value = true;
  error.value = "";
  try {
    await persist();
    draft.coverImage = await addImage(file, snapshot());
    await persist();
  } catch (reason) {
    error.value =
      reason instanceof Error
        ? reason.message
        : "대표 이미지를 저장하지 못했어요.";
  } finally {
    uploading.value = false;
    input.value = "";
  }
}
async function publish() {
  if (publishing.value || uploading.value) return;
  error.value = "";
  addTags();
  if (error.value) return;
  if (!draft.title.trim()) {
    error.value = "제목을 입력해 주세요.";
    showWriting();
    await nextTick();
    titleInput.value?.focus();
    return;
  }
  if (!draft.content.trim()) {
    error.value = "본문을 작성해 주세요.";
    showWriting();
    return;
  }
  if (!draft.category.trim()) {
    error.value = "카테고리를 하나 입력해 주세요.";
    showWriting();
    await nextTick();
    categoryInput.value?.focus();
    return;
  }
  if (auth.user.value?.id !== draft.authorId) {
    error.value = "다시 로그인한 후 게시해 주세요.";
    return;
  }
  publishing.value = true;
  try {
    await persist(false);
    const post = await publishDraft(snapshot());
    complete = true;
    await router.replace({
      name: "blog-post",
      params: {
        authorSlug: authorSlug(draft.author.name),
        postSlug: post.slug,
      },
      state: { blogPrevious: null },
    });
  } catch (reason) {
    error.value =
      reason instanceof Error
        ? reason.message
        : "글을 저장하지 못했어요. 작성 내용은 이 화면에서 다시 확인할 수 있어요.";
  } finally {
    publishing.value = false;
  }
}
function exit() {
  return router.push({
    name: "user-blog",
    params: { authorSlug: authorSlug(draft.author.name) },
  });
}
function beforeUnload(event: BeforeUnloadEvent) {
  if ((dirty.value || saving.value || uploading.value) && !complete) {
    event.preventDefault();
    event.returnValue = "";
  }
}
function saveShortcut(event: KeyboardEvent) {
  if (
    !event.defaultPrevented &&
    (event.metaKey || event.ctrlKey) &&
    event.key.toLowerCase() === "s"
  ) {
    event.preventDefault();
    void saveNow();
  }
}
onBeforeRouteLeave(async () => {
  if (publishing.value && !complete) return false;
  if (uploading.value) {
    error.value = "이미지 저장이 끝난 후 이동해 주세요.";
    return false;
  }
  if (complete || loading.value || loadError.value) return true;
  if (dirty.value || saving.value) {
    try {
      await persist(false);
    } catch {
      return window.confirm(
        "초안을 저장하지 못했어요. 저장되지 않은 내용을 남겨두고 나갈까요?",
      );
    }
  }
  return true;
});
onMounted(async () => {
  syncScreenMode();
  compactScreen.addEventListener("change", syncScreenMode);
  window.addEventListener("beforeunload", beforeUnload);
  window.addEventListener("keydown", saveShortcut);
  window.addEventListener("resize", resizeTitle);
  try {
    if (!owner) throw new Error("글을 작성하려면 로그인해 주세요.");
    if (typeof route.params.draftId === "string" && route.params.draftId) {
      const saved = await readDraft(route.params.draftId, owner.id);
      if (!saved) throw new Error("이 계정의 작성 내용을 찾을 수 없어요.");
      Object.assign(draft, saved);
      if (draft.postId) await loadLocalPosts();
    }
    await nextTick();
  } catch (reason) {
    loadError.value =
      reason instanceof Error
        ? reason.message
        : "작성 내용을 불러오지 못했어요.";
  } finally {
    loading.value = false;
    nextTick(resizeTitle);
  }
});
onBeforeUnmount(() => {
  clearTimeout(timer);
  cancelAnimationFrame(scrollFrame);
  cancelAnimationFrame(restoreFrame);
  compactScreen.removeEventListener("change", syncScreenMode);
  window.removeEventListener("beforeunload", beforeUnload);
  window.removeEventListener("keydown", saveShortcut);
  window.removeEventListener("resize", resizeTitle);
});
</script>

<template>
  <div class="writer-shell">
    <header class="writer-header">
      <button class="brand" aria-label="내 블로그로 돌아가기" @click="exit">
        <BrandLogo />
      </button>
      <span class="writer-header-label">/ <span>글쓰기</span></span>
      <div class="writer-header-actions">
        <ThemeToggle /><button class="writer-exit" @click="exit">
          <Icon name="close" :size="18" /><span>나가기</span>
        </button>
      </div>
    </header>
    <main v-if="loading || loadError" class="writer-load" role="status">
      <p>{{ loadError || "편집기를 준비하고 있어요." }}</p>
      <button v-if="loadError" @click="exit">내 블로그로 돌아가기</button>
    </main>
    <main v-else class="writer-workspace" :aria-busy="publishing">
      <div class="writer-byline">
        <span class="writer-author"
          ><span class="writer-author-dot"></span>{{ draft.author.name }}의
          {{ draft.postId ? "글 수정" : "새로운 기록" }}</span
        >
        <div class="writer-modes" role="group" aria-label="편집 화면 모드">
          <button :aria-pressed="mode === 'preview'" @click="mode = 'preview'">
            미리보기</button
          ><button :aria-pressed="mode !== 'preview'" @click="showWriting">
            작성
          </button>
        </div>
        <div class="writer-publish-actions">
          <label class="writer-visibility">
            <Icon
              :name="draft.visibility === 'PRIVATE' ? 'lock' : 'eye'"
              :size="14"
            />
            <select
              v-model="draft.visibility"
              aria-label="글 공개 설정"
              :disabled="publishing"
            >
              <option value="PUBLIC">공개</option>
              <option value="PRIVATE">비공개</option>
            </select>
          </label>
          <button
            class="writer-publish"
            :disabled="publishing || uploading"
            @click="publish"
          >
            {{ publishing ? "저장 중…" : draft.postId ? "수정" : "생성" }}
          </button>
        </div>
      </div>
      <div
        v-if="selectedImage"
        class="writer-image-settings"
        role="group"
        aria-label="이미지 크기와 정렬"
      >
        <div class="writer-image-settings-label">
          <EditorIcon name="image" /><span
            >이미지 설정<small>{{
              selectedImage.alt || "첨부 이미지"
            }}</small></span
          >
        </div>
        <label class="writer-image-width"
          ><span>너비</span
          ><input
            type="range"
            min="10"
            max="100"
            step="5"
            :value="selectedImage.width"
            :disabled="publishing"
            aria-label="이미지 너비"
            :aria-valuetext="`본문 너비의 ${selectedImage.width}%`"
            @input="
              updateImageLayout({
                width: Number(($event.target as HTMLInputElement).value),
              })
            "
          /><output>{{
            selectedImage.original ? "원본" : `${selectedImage.width}%`
          }}</output></label
        >
        <div
          class="writer-image-presets"
          role="group"
          aria-label="이미지 크기 프리셋"
        >
          <button
            v-if="!selectedImage.rowSize"
            :aria-pressed="selectedImage.original === true"
            :disabled="publishing"
            @click="updateImageLayout({ original: true })"
          >
            원본
          </button>
          <button
            v-for="width in [25, 50, 75, 100]"
            :key="width"
            :aria-pressed="
              !selectedImage.original && selectedImage.width === width
            "
            :disabled="publishing"
            @click="updateImageLayout({ width })"
          >
            {{ width }}%
          </button>
        </div>
        <span v-if="selectedImage.rowSize" class="writer-image-row-hint"
          >{{ selectedImage.rowSize }}장을 한 줄에 배치</span
        >
        <div
          v-else
          class="writer-image-align"
          role="group"
          aria-label="이미지 정렬"
        >
          <button
            v-for="align in alignments"
            :key="align.value"
            :title="align.label"
            :aria-label="align.label"
            :aria-pressed="selectedImage.align === align.value"
            :disabled="publishing"
            @click="updateImageLayout({ align: align.value })"
          >
            <EditorIcon :name="`align-${align.value}`" />
          </button>
        </div>
        <button
          class="writer-image-done"
          aria-label="이미지 설정 완료"
          @click="selectedImage = undefined"
        >
          <Icon name="check" :size="16" /><span>완료</span>
        </button>
      </div>
      <div class="writer-layout" :data-mode="mode">
        <section class="writer-preview-column" aria-label="제목과 미리보기">
          <section class="writer-intro" aria-label="글 정보">
            <div class="writer-title-row">
              <textarea
                ref="titleInput"
                v-model="draft.title"
                class="writer-title"
                rows="1"
                maxlength="160"
                placeholder="제목을 입력하세요"
                aria-label="게시글 제목"
                :disabled="publishing"
                @keydown.enter="!$event.isComposing && $event.preventDefault()"
              ></textarea>
              <div class="writer-cover" aria-label="대표 이미지 설정">
                <template v-if="draft.coverImage">
                  <button
                    class="writer-cover-thumbnail"
                    aria-label="대표 이미지 변경"
                    :disabled="uploading || publishing"
                    @click="coverInput?.click()"
                  >
                    <CoverImage
                      :src="draft.coverImage"
                      :author-id="draft.authorId"
                      alt="선택한 대표 이미지"
                      loading="eager"
                    >
                      <EditorIcon name="image" />
                    </CoverImage>
                  </button>
                  <span>대표 이미지</span>
                  <button
                    class="writer-cover-action"
                    :disabled="uploading || publishing"
                    @click="coverInput?.click()"
                  >
                    변경
                  </button>
                  <button
                    class="writer-cover-action"
                    aria-label="대표 이미지 삭제"
                    :disabled="uploading || publishing"
                    @click="draft.coverImage = undefined"
                  >
                    삭제
                  </button>
                </template>
                <button
                  v-else
                  class="writer-cover-add"
                  title="글 목록에 표시할 이미지 선택 (최대 5MB)"
                  :disabled="uploading || publishing"
                  @click="coverInput?.click()"
                >
                  <EditorIcon name="image" />대표 이미지 추가
                </button>
              </div>
            </div>
            <div class="writer-metadata">
              <label class="writer-category"
                ><EditorIcon name="folder" /><span class="writer-sr-only"
                  >큰 카테고리</span
                ><input
                  ref="categoryInput"
                  v-model="draft.category"
                  aria-label="큰 카테고리"
                  placeholder="카테고리 하나 입력"
                  maxlength="40"
                  required
                  :disabled="publishing"
              /></label>
              <span class="writer-meta-divider"></span>
              <div class="writer-tags">
                <EditorIcon name="tag" /><span
                  v-for="(tag, index) in draft.tags"
                  :key="tag"
                  class="writer-tag"
                  >{{ tag
                  }}<button
                    :aria-label="`${tag} 태그 삭제`"
                    :disabled="publishing"
                    @click="draft.tags.splice(index, 1)"
                  >
                    <Icon name="close" :size="12" /></button></span
                ><input
                  v-model="tagInput"
                  aria-label="태그 추가"
                  :placeholder="
                    draft.tags.length ? '태그 추가' : '태그를 입력하고 Enter'
                  "
                  maxlength="100"
                  :disabled="publishing"
                  @keydown="tagKeydown"
                  @blur="addTags"
                />
              </div>
            </div>
          </section>
          <section class="writer-preview">
            <div
              ref="previewPane"
              class="writer-preview-scroll"
              @scroll="syncScroll('preview')"
            >
              <PostArticle
                v-if="draft.content || mode === 'preview'"
                :post="previewPost"
                :show-header="mode === 'preview'"
                :interactive="false"
                :editable-images="!publishing"
                :selected-image="selectedImage?.key"
                @select-image="editImage"
              />
              <div v-else class="writer-preview-empty">
                <div class="writer-empty-rule"></div>
                <p>
                  작은 배움도 좋은 기록이 됩니다.<br />작성한 글이 이곳에
                  자연스럽게 펼쳐져요.
                </p>
                <EditorIcon name="pen" />
              </div>
            </div>
          </section>
        </section>
        <section class="writer-composer" aria-label="마크다운 글 작성">
          <div class="writer-toolbar">
            <div class="writer-tools" role="toolbar" aria-label="마크다운 서식">
              <button
                v-for="tool in tools"
                :key="tool.action"
                :class="{ 'writer-tool-divider': tool.group }"
                :title="tool.label"
                :aria-label="tool.label"
                :disabled="publishing"
                @mousedown.prevent
                @click="format(tool.action)"
              >
                <span v-if="tool.text" class="writer-heading-tool">{{
                  tool.text
                }}</span
                ><EditorIcon v-else :name="tool.action" />
              </button>
              <button
                class="writer-tool-divider"
                title="링크 추가"
                aria-label="링크 추가"
                :disabled="publishing"
                @mousedown.prevent
                @click="openLink"
              >
                <EditorIcon name="link" />
              </button>
              <button
                title="이미지 추가"
                aria-label="이미지 추가"
                :disabled="uploading || publishing"
                @mousedown.prevent
                @click="fileInput?.click()"
              >
                <EditorIcon name="image" />
              </button>
              <button
                class="writer-tool-divider"
                title="실행 취소"
                aria-label="실행 취소"
                :disabled="publishing"
                @mousedown.prevent
                @click="editor?.undo()"
              >
                <EditorIcon name="undo" />
              </button>
              <button
                title="다시 실행"
                aria-label="다시 실행"
                :disabled="publishing"
                @mousedown.prevent
                @click="editor?.redo()"
              >
                <EditorIcon name="redo" />
              </button>
            </div>
          </div>
          <section class="writer-source">
            <MarkdownEditor
              ref="editor"
              v-model="draft.content"
              :disabled="publishing"
              @save="saveNow"
              @images="insertImages"
              @scroll="syncScroll('source')"
            />
          </section>
        </section>
      </div>
      <p v-if="error" class="writer-error" role="alert">
        {{ error
        }}<button aria-label="알림 닫기" @click="error = ''">
          <Icon name="close" :size="16" />
        </button>
      </p>
      <div class="writer-bottom-space" aria-hidden="true"></div>
    </main>
    <input
      ref="fileInput"
      class="writer-sr-only"
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif"
      multiple
      tabindex="-1"
      aria-label="업로드할 이미지"
      @change="chooseFiles"
    />
    <input
      ref="coverInput"
      class="writer-sr-only"
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif"
      tabindex="-1"
      aria-label="업로드할 대표 이미지"
      @change="chooseCover"
    />
    <dialog ref="linkDialog" class="writer-link-dialog">
      <form @submit.prevent="insertLink">
        <div class="writer-dialog-heading">
          <h2>링크 추가</h2>
          <button
            type="button"
            aria-label="링크 창 닫기"
            @click="linkDialog?.close()"
          >
            <Icon name="close" :size="20" />
          </button>
        </div>
        <label
          >표시할 텍스트<input
            v-model="linkLabel"
            placeholder="링크 이름"
            autofocus /></label
        ><label
          >링크 주소<input v-model="linkUrl" placeholder="https://" required
        /></label>
        <p v-if="linkError" role="alert">{{ linkError }}</p>
        <button class="writer-publish" type="submit">
          추가하기<Icon name="arrow-right" :size="16" />
        </button>
      </form>
    </dialog>
  </div>
</template>
