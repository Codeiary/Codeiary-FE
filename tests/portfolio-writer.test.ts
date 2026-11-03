import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createMemoryHistory, createRouter, RouterView, type Router } from "vue-router";
import PortfolioWriteView from "@/views/PortfolioWriteView.vue";
import PortfolioRichTextEditor from "@/components/portfolio/PortfolioRichTextEditor.vue";
import PortfolioDocument from "@/components/portfolio/PortfolioDocument.vue";
import type { Editor } from "@tiptap/vue-3";
import { auth, type UserProfile } from "@/store/auth";
import { portfolios, type PortfolioItem } from "@/store/portfolio";
import { contentFromEditorDocument } from "@/utils/portfolio/rich-text";
import { userFixture } from "./fixtures/auth";

vi.mock("@/store/auth", async () => {
  const { shallowRef } = await import("vue");
  return { auth: { user: shallowRef(null), uploadBlogImage: vi.fn() } };
});
// Markdown rendering is covered separately; keep the actual canvas, controls,
// model, and writer mounted while avoiding asynchronous renderer dependencies.
vi.mock("@/utils/blog/markdown-loader", () => ({
  loadMarkdownContent: async () => ({
    props: ["content"], template: "<div>{{ content }}</div>",
  }),
}));
vi.mock("@/utils/portfolio/fonts", async (original) => ({
  ...await original<typeof import("@/utils/portfolio/fonts")>(),
  loadPortfolioFont: vi.fn(),
}));

const user = auth.user as { value: UserProfile | null };
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const originalPortfolios = copy(portfolios.value);
const mounted: { wrapper: VueWrapper; router: Router }[] = [];

async function render(id?: number) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/portfolio/write", name: "portfolio-write", component: PortfolioWriteView },
      { path: "/portfolio", name: "portfolio", component: { template: "<main>내 포트폴리오</main>" } },
      { path: "/home", name: "user-home", component: { template: "<main>마이페이지</main>" } },
    ],
  });
  await router.push({ name: "portfolio-write", query: id ? { id: String(id) } : {} });
  await router.isReady();
  const wrapper = mount(RouterView, {
    attachTo: document.body,
    global: { plugins: [router], stubs: { ThemeToggle: true } },
  });
  mounted.push({ wrapper, router });
  await flushPromises();
  return { wrapper, router };
}

function button(wrapper: VueWrapper, name: string, scope = "") {
  const result = wrapper.findAll(scope ? `${scope} button` : "button").find((candidate) => {
    if (candidate.attributes("aria-label")) return candidate.attributes("aria-label") === name;
    const content = candidate.element.cloneNode(true) as HTMLElement;
    content.querySelectorAll('[aria-hidden="true"]').forEach((element) => element.remove());
    return content.textContent?.replace(/\s+/g, " ").trim() === name;
  });
  if (!result) throw new Error(`버튼을 찾을 수 없습니다: ${name}`);
  return result;
}

function canvasBlocks(wrapper: VueWrapper) {
  return wrapper.findAll('[aria-label="포트폴리오 캔버스"] [data-block-id]');
}
function renderedPosition(wrapper: VueWrapper, id: string | undefined) {
  const block = canvasBlocks(wrapper).find((item) => item.attributes("data-block-id") === id);
  if (!block) throw new Error(`요소를 찾을 수 없습니다: ${id}`);
  const style = (block.element as HTMLElement).style;
  return { x: Number.parseFloat(style.left), y: Number.parseFloat(style.top), width: Number.parseFloat(style.width) };
}

function canvasContents(wrapper: VueWrapper) {
  return canvasBlocks(wrapper).map((block) => block.find('[role="textbox"]').exists()
    ? activeEditor(wrapper).getText({ blockSeparator: "\n\n" }) : block.get("p, h2, h3").text());
}
function activeEditor(wrapper: VueWrapper) {
  return (wrapper.getComponent(PortfolioRichTextEditor).vm as unknown as { editor: Editor }).editor;
}
async function writeCanvas(wrapper: VueWrapper, content: string) {
  await flushPromises();
  // DOM emulators do not implement native contenteditable typing. Use the real
  // editor's input command, keeping its events and writer bindings mounted.
  const lines = content.split("\n");
  activeEditor(wrapper).commands.setContent({ type: "doc", content: [{ type: "paragraph", content: lines.flatMap((text, index) => [
    ...(index ? [{ type: "hardBreak" }] : []), ...(text ? [{ type: "text", text }] : []),
  ]) }] });
  await flushPromises();
}
function canvasText(wrapper: VueWrapper) {
  return wrapper.get('[aria-label="포트폴리오 캔버스"] [role="textbox"]').text();
}
async function writeTitle(wrapper: VueWrapper, title: string) {
  if (!wrapper.find('[aria-label="포트폴리오 제목 직접 편집"]').exists())
    await wrapper.get('.portfolio-document-title').trigger("click");
  await writeCanvas(wrapper, title);
}
async function openPageDesign(wrapper: VueWrapper) {
  await button(wrapper, "페이지", '[aria-label="포트폴리오 편집 설정"]').trigger("click");
}

describe("포트폴리오 스튜디오 편집과 저장", () => {
  it("헤더에서 공개 여부를 고르고 저장하지 않은 변경은 확인한 뒤 나간다", async () => {
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal("confirm", confirm);
    const { wrapper, router } = await render();
    await wrapper.get('.writer-header [aria-label="포트폴리오 공개 설정"]').setValue("PRIVATE");
    await writeTitle(wrapper, "수정 중인 포트폴리오");
    await button(wrapper, "나가기").trigger("click");
    await flushPromises();
    expect(confirm).toHaveBeenCalledOnce();
    expect(router.currentRoute.value.name).toBe("portfolio-write");
    expect(canvasText(wrapper)).toBe("수정 중인 포트폴리오");
    confirm.mockReturnValue(true);
    await button(wrapper, "나가기").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("user-home");
    expect(router.currentRoute.value.query).toEqual({ tab: "portfolio" });
  });
  it("저장하지 않은 최신 내용을 편집 도구 없이 PDF 출력하고 취소 후 편집기로 복귀한다", async () => {
    user.value = userFixture("USER");
    portfolios.value = [];
    const print = vi.fn();
    vi.stubGlobal("print", print);
    const title = document.title;
    const { wrapper } = await render();
    await writeTitle(wrapper, "PDF 내보내기 검증");
    await button(wrapper, "텍스트 블록 추가").trigger("click");
    await writeCanvas(wrapper, "아직 저장하지 않은 본문입니다.");
    await openPageDesign(wrapper);
    await button(wrapper, "PDF 내보내기").trigger("click");
    await vi.waitFor(() => expect(print).toHaveBeenCalledOnce());
    const output = document.querySelector(".portfolio-print-root")!;
    expect(output.textContent).toContain("PDF 내보내기 검증");
    expect(output.textContent).toContain("아직 저장하지 않은 본문입니다.");
    expect(output.querySelector("button, [contenteditable='true'], .portfolio-document-actions")).toBeNull();
    expect(document.title).toBe("PDF 내보내기 검증");
    expect(portfolios.value).toEqual([]);
    window.dispatchEvent(new Event("afterprint"));
    await flushPromises();
    expect(document.querySelector(".portfolio-print-root")).toBeNull();
    expect(document.title).toBe(title);
    expect(button(wrapper, "PDF 내보내기").attributes("disabled")).toBeUndefined();
    expect(canvasText(wrapper)).toBe("아직 저장하지 않은 본문입니다.");
  });
  beforeEach(() => {
    vi.clearAllMocks();
    user.value = userFixture();
    portfolios.value = [];
  });
  afterEach(() => {
    mounted.splice(0).forEach(({ wrapper, router }) => {
      wrapper.unmount();
      router.options.history.destroy();
    });
    portfolios.value = copy(originalPortfolios);
    user.value = null;
    vi.unstubAllGlobals();
  });

  it("기존 원문을 보존하며 디자인과 블록 설정을 저장하고 다시 편집한다", async () => {
    const source = "## 구현 기록\n\n| 선택 | 이유 |\n| --- | --- |\n| Vue | **반응성** |\n\n[작업 저장소](https://github.com/example/work)\n";
    const original: PortfolioItem = {
      id: 42, author: { id: 1, name: "기록자" }, title: "기존 작업", summary: "기존 요약", content: source,
      visibility: "PRIVATE",
      blocks: [{ id: "legacy-body", type: "markdown", content: source, align: "left", position: { x: 65, y: 40, width: 30 } }],
    };
    portfolios.value = [copy(original)];
    const { wrapper, router } = await render(42);

    await canvasBlocks(wrapper)[0]!.trigger("click");
    expect(canvasBlocks(wrapper)[0]!.text()).toContain("구현 기록");
    expect(wrapper.find('[aria-label="포트폴리오 편집 설정"] textarea').exists()).toBe(false);
    await button(wrapper, "가운데 정렬").trigger("click");
    // Pointer geometry is covered by PortfolioDocument; verify its resize event
    // survives the actual writer save/reopen flow.
    wrapper.getComponent(PortfolioDocument).vm.$emit("updateBlock", "legacy-body", {
      position: { x: 50, y: 40, width: 50, height: 120 },
    });
    await flushPromises();
    await button(wrapper, "블록 위로 이동").trigger("click");
    await button(wrapper, "블록 위로 이동").trigger("click");
    expect(renderedPosition(wrapper, "legacy-body").y).toBe(0);
    expect(button(wrapper, "블록 위로 이동").attributes("disabled")).toBeDefined();
    await button(wrapper, "블록 아래로 이동").trigger("click");
    await button(wrapper, "블록 아래로 이동").trigger("click");
    await openPageDesign(wrapper);
    const pagePanel = wrapper.get('[aria-label="포트폴리오 편집 설정"]');
    expect(pagePanel.find("details, summary").exists()).toBe(false);
    expect(pagePanel.find('[aria-label="페이지 너비 조절"], [aria-label="페이지 너비(px)"]').exists()).toBe(false);
    expect(pagePanel.find('[aria-label="페이지 글꼴"]').exists()).toBe(false);
    expect(wrapper.find('.writer-header [aria-label="포트폴리오 공개 설정"]').exists()).toBe(true);
    expect(portfolios.value[0]).toEqual(original);

    await button(wrapper, "저장").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("portfolio");
    expect(router.currentRoute.value.query.portfolioId).toBe("42");
    const saved = copy(portfolios.value[0]!);
    expect(saved.content).toBe(source);
    expect(saved.visibility).toBe("PRIVATE");
    expect(saved.blocks).toEqual([expect.objectContaining({
      type: "markdown", content: source, align: "center", position: { x: 50, y: 40, width: 50, height: 120 },
    })]);

    await router.push({ name: "portfolio-write", query: { id: "42" } });
    await flushPromises();
    await openPageDesign(wrapper);
    await canvasBlocks(wrapper)[0]!.trigger("click");
    expect(canvasBlocks(wrapper)[0]!.text()).toContain("구현 기록");
    expect(button(wrapper, "가운데 정렬").attributes("aria-pressed")).toBe("true");
    expect(pagePanel.find('[aria-label="블록 배경"], [aria-label="블록 너비"]').exists()).toBe(false);
    expect(canvasBlocks(wrapper)[0]!.attributes("style")).toContain("width: 50%");
    expect(canvasBlocks(wrapper)[0]!.attributes("style")).toContain("height: 120px");
    expect(canvasBlocks(wrapper)[0]!.attributes("data-block-id")).toBe(saved.blocks![0]!.id);
    expect(portfolios.value[0]).toEqual(saved);
    await writeCanvas(wrapper, "캔버스에서 직접 고친 본문입니다.");
    // The stored source stays intact until an actual edit is saved.
    expect(portfolios.value[0]!.content).toBe(source);
    await button(wrapper, "저장").trigger("click");
    await flushPromises();
    expect(portfolios.value[0]!.blocks![0]).toMatchObject({ type: "markdown", content: "캔버스에서 직접 고친 본문입니다." });
    expect(portfolios.value[0]!.content).not.toContain("| 선택 | 이유 |");
  });

  it("캔버스 편집·위치 이동·실행 취소·복제·삭제 복원 결과를 저장하고 다시 편집한다", async () => {
    const { wrapper, router } = await render();
    await writeTitle(wrapper, "새 작업 모음");
    activeEditor(wrapper).commands.setTextSelection({ from: 1, to: 3 });
    activeEditor(wrapper).commands.setColor("#336699");
    activeEditor(wrapper).commands.setFontSize("40px");
    await button(wrapper, "제목 가운데 정렬").trigger("click");
    await button(wrapper, "텍스트 블록 추가").trigger("click");
    await writeCanvas(wrapper, "첫 번째 설명");
    await button(wrapper, "텍스트 블록 추가").trigger("click");
    await writeCanvas(wrapper, "작업 과정");
    await button(wrapper, "텍스트 블록 추가").trigger("click");
    await writeCanvas(wrapper, "마지막 설명");
    const firstId = canvasBlocks(wrapper)[0]!.attributes("data-block-id");

    await canvasBlocks(wrapper)[0]!.trigger("click");
    await flushPromises();
    expect(canvasText(wrapper)).toBe("첫 번째 설명");
    const literalText = "# 그대로 적은 제목\n**강조 표시도 텍스트**";
    await writeCanvas(wrapper, literalText);
    activeEditor(wrapper).commands.setTextSelection({ from: 3, to: 6 });
    await wrapper.get('select[aria-label="선택 글꼴"]').setValue("jua");
    // A typed style must apply before blur/change, just like native typing.
    const colorCode = wrapper.get<HTMLInputElement>('input[aria-label="선택 글자 색상 코드"]');
    colorCode.element.value = "#c4667c";
    await colorCode.trigger("input");
    const fontSize = wrapper.get<HTMLInputElement>('input[aria-label="선택 글자 크기"]');
    fontSize.element.value = "28";
    await fontSize.trigger("input");
    expect(canvasBlocks(wrapper)[0]!.find('[role="textbox"] strong, [role="textbox"] h1').exists()).toBe(false);
    const initialPosition = renderedPosition(wrapper, firstId);
    await button(wrapper, "블록 아래로 이동").trigger("click");
    expect(renderedPosition(wrapper, firstId)).toEqual({ ...initialPosition, y: initialPosition.y + 20 });
    await button(wrapper, "실행 취소").trigger("click");
    expect(renderedPosition(wrapper, firstId)).toEqual(initialPosition);
    await button(wrapper, "다시 실행").trigger("click");
    expect(renderedPosition(wrapper, firstId)).toEqual({ ...initialPosition, y: initialPosition.y + 20 });
    await button(wrapper, "블록 삭제").trigger("click");
    expect(canvasContents(wrapper)).toEqual(["작업 과정", "마지막 설명"]);
    await button(wrapper, "실행 취소").trigger("click");
    await flushPromises();
    await canvasBlocks(wrapper)[0]!.trigger("click");
    await flushPromises();
    expect(activeEditor(wrapper).getText({ blockSeparator: "\n" })).toBe(literalText);
    const movedPosition = renderedPosition(wrapper, firstId);
    const originalIds = canvasBlocks(wrapper).map((block) => block.attributes("data-block-id"));
    await button(wrapper, "블록 복제").trigger("click");
    await flushPromises();
    const duplicateId = canvasBlocks(wrapper).find((block) => !originalIds.includes(block.attributes("data-block-id")))!.attributes("data-block-id");
    const duplicatePosition = { ...movedPosition, x: movedPosition.x + 2, y: movedPosition.y + 24 };
    expect(renderedPosition(wrapper, duplicateId)).toEqual(duplicatePosition);
    expect(renderedPosition(wrapper, firstId)).toEqual(movedPosition);

    await button(wrapper, "저장").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("portfolio");
    expect(portfolios.value).toHaveLength(1);
    expect(portfolios.value[0]!.title).toBe("새 작업 모음");
    expect(portfolios.value[0]!.titleRuns?.[0]).toMatchObject({ text: "새 ", color: "#336699", size: 40 });
    expect(portfolios.value[0]!.titleAlign).toBe("center");
    expect(portfolios.value[0]!.blocks?.map((block) => ({ type: block.type, content: contentFromEditorDocument(block.document).content }))).toEqual([
      { type: "markdown", content: literalText }, { type: "markdown", content: literalText },
      { type: "markdown", content: "작업 과정" }, { type: "markdown", content: "마지막 설명" },
    ]);
    const styledText = portfolios.value[0]!.blocks?.find((block) => block.id === firstId);
    expect(contentFromEditorDocument(styledText?.document).runs).toContainEqual({ text: "그대로", font: "jua", color: "#c4667c", size: 28 });
    expect(contentFromEditorDocument(styledText?.document).runs.some((run) => !run.font && !run.color && !run.size)).toBe(true);
    expect(styledText?.position).toEqual(movedPosition);
    expect(portfolios.value[0]!.blocks?.find((block) => block.id === duplicateId)?.position).toEqual(duplicatePosition);
    const saved = copy(portfolios.value[0]!);
    await router.push({ name: "portfolio-write", query: { id: String(saved.id) } });
    await flushPromises();
    await canvasBlocks(wrapper).find((block) => block.attributes("data-block-id") === firstId)!.trigger("click");
    await flushPromises();
    expect(activeEditor(wrapper).getText({ blockSeparator: "\n" })).toBe(literalText);
    expect(portfolios.value[0]!.blocks?.find((block) => block.id === firstId)?.document).toEqual(styledText?.document);
    expect(wrapper.get(".portfolio-document-header").attributes("style")).toContain("text-align: center");
  });

  it("로그인 전과 편집 중 로그아웃 후에는 버튼과 저장 단축키로 저장할 수 없다", async () => {
    user.value = null;
    const { wrapper, router } = await render();
    expect(wrapper.get('[role="alert"]').text()).toContain("로그인해 주세요");
    expect(button(wrapper, "저장").attributes("disabled")).toBeDefined();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, cancelable: true }));
    await flushPromises();
    expect(portfolios.value).toEqual([]);

    user.value = userFixture();
    await flushPromises();
    await writeTitle(wrapper, "작성 중인 작업");
    await button(wrapper, "텍스트 블록 추가").trigger("click");
    await writeCanvas(wrapper, "저장할 수 있는 본문");
    user.value = null;
    await flushPromises();
    expect(button(wrapper, "저장").attributes("disabled")).toBeDefined();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", metaKey: true, cancelable: true }));
    await button(wrapper, "저장").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("portfolio-write");
    expect(portfolios.value).toEqual([]);
  });

  it("다른 사람의 포트폴리오는 편집 주소로 접근해도 수정할 수 없다", async () => {
    const original: PortfolioItem = {
      id: 1, author: { id: 1, name: "기록자" }, title: "다른 사람의 포트폴리오",
      summary: "소개", content: "본문", visibility: "PUBLIC",
    };
    portfolios.value = [original];
    user.value = { ...userFixture(), id: 2 };
    const { wrapper } = await render(original.id);
    expect(wrapper.get('[role="alert"]').text()).toContain("내가 작성한 포트폴리오만");
    expect(button(wrapper, "저장").attributes("disabled")).toBeDefined();
    expect(wrapper.find(".portfolio-document-title").text()).not.toContain(original.title);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, cancelable: true }));
    await flushPromises();
    expect(portfolios.value).toEqual([original]);
  });

  it("이미지 버튼은 파일 선택창을 바로 열고 선택 후에만 이미지를 추가해 저장한다", async () => {
    const { wrapper, router } = await render();
    await writeTitle(wrapper, "이미지로 소개하는 작업");
    const fileInput = wrapper.findAll('input[type="file"]')[0]!;
    const openPicker = vi.spyOn(fileInput.element as HTMLInputElement, "click");
    await button(wrapper, "이미지 블록 추가").trigger("click");
    expect(openPicker).toHaveBeenCalledOnce();
    expect(canvasBlocks(wrapper)).toHaveLength(0);
    openPicker.mockRestore();
    await button(wrapper, "저장").trigger("click");
    expect(wrapper.get('[role="alert"]').text()).toContain("텍스트나 이미지를 추가해 주세요");
    expect(router.currentRoute.value.name).toBe("portfolio-write");
    expect(portfolios.value).toEqual([]);

    const imageUrl = "https://images.example.test/portfolio.png";
    const file = new File(["sample image"], "portfolio.png", { type: "image/png" });
    vi.mocked(auth.uploadBlogImage).mockResolvedValueOnce(imageUrl);
    Object.defineProperty(fileInput.element, "files", { value: [file], configurable: true });
    await fileInput.trigger("change");
    await flushPromises();
    expect(auth.uploadBlogImage).toHaveBeenCalledExactlyOnceWith(file);
    expect(button(wrapper, "이미지 교체").exists()).toBe(true);
    expect(wrapper.find('[aria-label="블록 정렬"]').exists()).toBe(false);
    expect(wrapper.find('input[placeholder="이미지에 담긴 내용을 설명해 주세요"]').exists()).toBe(false);
    await button(wrapper, "저장").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("portfolio");
    expect(portfolios.value[0]!.blocks).toEqual([expect.objectContaining({
      type: "image", imageUrl, alt: "portfolio",
    })]);
    expect(portfolios.value[0]!.content).toContain(imageUrl);

    await router.push({ name: "portfolio-write", query: { id: String(portfolios.value[0]!.id) } });
    await flushPromises();

    expect(wrapper.get('img[alt="portfolio"]').attributes("src")).toBe(imageUrl);
  });
});
