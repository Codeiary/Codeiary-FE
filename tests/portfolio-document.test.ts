// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import type { Editor } from "@tiptap/vue-3";
import PortfolioDocument from "@/components/portfolio/PortfolioDocument.vue";
import { createPortfolioBlock, type PortfolioBlock } from "@/utils/portfolio/layout";
import { postFixture } from "./fixtures/blog";

const wrappers: VueWrapper[] = [];
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  document.querySelectorAll("[data-portfolio-test-target]").forEach((element) => element.remove());
  vi.restoreAllMocks();
});
async function pointer(element: Element, type: string, x: number, y: number, pointerId = 1, pointerType = "mouse") {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
  Object.defineProperties(event, {
    pointerId: { value: pointerId }, pointerType: { value: pointerType }, isPrimary: { value: true },
  });
  element.dispatchEvent(event);
  await nextTick();
}
function capturePointer(element: Element) {
  let captured: number | undefined;
  const capture = vi.fn((id: number) => { captured = id; });
  const release = vi.fn(() => { captured = undefined; });
  Object.defineProperties(element, {
    setPointerCapture: { value: capture },
    hasPointerCapture: { value: (id: number) => captured === id },
    releasePointerCapture: { value: release },
  });
  return { capture, release };
}

describe("포트폴리오 문서", () => {

  it("드래그 시작 시 기존 배치를 유지하고 글자를 X·Y 방향으로 옮기며 캔버스 경계를 지킨다.", async () => {
    const blocks = [
      createPortfolioBlock("text", { id: "first", content: "첫 번째" }),
      createPortfolioBlock("text", { id: "second", content: "두 번째" }),
    ];
    const wrapper = mount(PortfolioDocument, {
      props: { post: postFixture(), blocks, editable: true },
    });
    wrappers.push(wrapper);
    const first = () => wrapper.get('[data-block-id="first"]');
    const second = () => wrapper.get('[data-block-id="second"]');
    const stage = wrapper.get(".portfolio-document-blocks");
    vi.spyOn(stage.element, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 200, 500, 300));
    vi.spyOn(first().element, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 200, 200, 80));
    vi.spyOn(second().element, "getBoundingClientRect").mockReturnValue(new DOMRect(350, 330, 250, 100));
    const handle = first().get("button").element;
    const { capture, release } = capturePointer(handle);
    await pointer(handle, "pointerdown", 110, 185);
    expect(capture).toHaveBeenCalledWith(1);
    await pointer(handle, "pointermove", 113, 187);
    expect(wrapper.emitted("updateBlock")).toBeUndefined();
    await pointer(handle, "pointermove", 210, 235);
    expect(wrapper.emitted("updateBlock")).toEqual([
      ["first", { position: { x: 0, y: 0, width: 40 } }],
      ["second", { position: { x: 50, y: 130, width: 50 } }],
      ["first", { position: { x: 20, y: 50, width: 40 } }],
    ]);
    expect(blocks[0]!.position).toBeUndefined();
    await wrapper.setProps({ blocks: [
      { ...blocks[0]!, position: { x: 20, y: 50, width: 40 } },
      { ...blocks[1]!, position: { x: 50, y: 130, width: 50 } },
    ] });
    expect(stage.classes()).toContain("portfolio-document-free");
    expect(first().attributes("style")).toContain("left: 20%");
    expect(first().attributes("style")).toContain("top: 50px");
    await pointer(handle, "pointermove", 10000, 50000);
    let updates = wrapper.emitted("updateBlock")!;
    expect(updates[updates.length - 1]).toEqual(["first", { position: { x: 60, y: 20000, width: 40 } }]);
    await pointer(handle, "pointermove", -500, -100);
    updates = wrapper.emitted("updateBlock")!;
    expect(updates[updates.length - 1]).toEqual(["first", { position: { x: 0, y: 0, width: 40 } }]);
    await pointer(handle, "pointerup", -500, -100);
    expect(release).toHaveBeenCalledWith(1);
    expect(first().classes()).not.toContain("portfolio-block-dragging");
  });

  it("모서리 드래그로 가로·세로 크기를 함께 바꾸고 원본 글자와 서식을 보존한다", async () => {
    const block = createPortfolioBlock("text", {
      id: "resize", content: "변하지 않는 본문", runs: [{ text: "변하지 않는 본문", size: 28 }],
      position: { x: 10, y: 20, width: 50, height: 120 },
    });
    const wrapper = mount(PortfolioDocument, { props: { post: postFixture(), blocks: [block], editable: true, selectedBlock: "resize" } });
    wrappers.push(wrapper);
    vi.spyOn(wrapper.get(".portfolio-document-blocks").element, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 500, 320));
    const handle = wrapper.get('[data-resize="se"]').element;
    const { release } = capturePointer(handle);
    await pointer(handle, "pointerdown", 100, 100);
    await pointer(handle, "pointermove", 150, 160);
    await pointer(handle, "pointerup", 150, 160);
    expect(wrapper.emitted("updateBlock")).toEqual([["resize", { position: { x: 10, y: 20, width: 60, height: 180 } }]]);
    expect(release).toHaveBeenCalledWith(1);
    expect(block.content).toBe("변하지 않는 본문");
    expect(block.runs).toEqual([{ text: "변하지 않는 본문", size: 28 }]);
    await wrapper.setProps({ blocks: [{ ...block, position: { x: 10, y: 20, width: 60, height: 180 } }] });
    expect(wrapper.get('[data-block-id="resize"]').attributes("style")).toContain("height: 180px");
  });

  it("이미지를 원본 크기에 맞추고 모서리로 비율을 유지해 줄이며 큰 이미지는 화면 안으로 맞춘다", async () => {
    const block = createPortfolioBlock("image", { id: "photo", imageUrl: "https://example.com/photo.png", position: { x: 4, y: 12, width: 60 } });
    const wrapper = mount(PortfolioDocument, { props: { post: postFixture(), blocks: [block], editable: true, selectedBlock: "photo" } });
    wrappers.push(wrapper);
    vi.spyOn(wrapper.get(".portfolio-document-blocks").element, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 800, 500));
    await vi.waitFor(() => expect(wrapper.find("img").exists()).toBe(true));
    const image = wrapper.get("img");
    Object.defineProperties(image.element, { naturalWidth: { value: 400, configurable: true }, naturalHeight: { value: 200, configurable: true } });
    await image.trigger("load");
    expect(wrapper.emitted("updateBlock")?.slice(-1)[0]).toEqual(["photo", { position: { x: 4, y: 12, width: 50, height: 200 } }]);
    await wrapper.setProps({ blocks: [{ ...block, position: { x: 4, y: 12, width: 50, height: 200 } }] });
    const handle = wrapper.get('[data-resize="se"]').element;
    capturePointer(handle);
    await pointer(handle, "pointerdown", 400, 200);
    await pointer(handle, "pointermove", 320, 160);
    await pointer(handle, "pointerup", 320, 160);
    expect(wrapper.emitted("updateBlock")?.slice(-1)[0]).toEqual(["photo", { position: { x: 4, y: 12, width: 40, height: 160 } }]);
    await wrapper.setProps({ blocks: [block] });
    Object.defineProperties(image.element, { naturalWidth: { value: 2000 }, naturalHeight: { value: 4000 } });
    await image.trigger("load");
    const fitted = (wrapper.emitted("updateBlock")!.slice(-1)[0]![1] as Partial<PortfolioBlock>).position!;
    expect(fitted.height).toBeLessThan(window.innerHeight);
    expect(fitted.width * 800 / 100 / fitted.height!).toBeCloseTo(.5);
  });

  it("글자별 서식을 안전한 span으로 표시하고 오래된 서식으로 삭제된 글자를 되살리지 않는다.", () => {
    const content = "안녕하세요 <script>alert(1)</script>";
    const wrapper = mount(PortfolioDocument, {
      props: {
        post: postFixture(),
        blocks: [
          createPortfolioBlock("text", {
            id: "styled", content,
            runs: [
              { text: "안녕하세요 ", font: "mono", color: "#123456", size: 28, bold: true },
              { text: "<script>alert(1)</script>", italic: true },
            ],
          }),
          {
            ...createPortfolioBlock("text", { id: "stale", content: "현재 제목" }),
            runs: [{ text: "삭제된 제목", color: "#ff0000" }],
          },
          {
            ...createPortfolioBlock("text", { id: "bad-style", content: "링크" }),
            runs: [{ text: "링크", color: "url(javascript:alert(1))", size: 1000000 }],
          },
        ],
      },
    });
    wrappers.push(wrapper);
    const spans = wrapper.findAll('[data-block-id="styled"] p > span');
    expect(spans).toHaveLength(2);
    expect((spans[0]!.element as HTMLElement).style.fontSize).toBe("28px");
    expect((spans[0]!.element as HTMLElement).style.fontWeight).toBe("700");
    expect((spans[1]!.element as HTMLElement).style.fontStyle).toBe("italic");
    expect(wrapper.get('[data-block-id="styled"]').text()).toBe(content);
    expect(wrapper.find("script").exists()).toBe(false);
    expect(wrapper.get('[data-block-id="stale"]').text()).toBe("현재 제목");
    expect(wrapper.text()).not.toContain("삭제된 제목");
    expect(wrapper.get('[data-block-id="bad-style"]').html()).not.toContain("javascript:");
    expect(wrapper.get('[data-block-id="bad-style"]').html()).not.toContain("1000000");
  });

  it("Java 펜스를 코드 블록으로 바꾸고 블록 안에서 언어를 바꾸며 색상과 저장 결과를 유지한다", async () => {
    const block = createPortfolioBlock("text", { id: "code", content: "" });
    const wrapper = mount(PortfolioDocument, { props: { post: postFixture(), blocks: [block], editable: true, selectedBlock: "code" } });
    wrappers.push(wrapper);
    await vi.waitFor(() => expect(wrapper.find('[contenteditable="true"]').exists()).toBe(true));
    const { default: RichEditor } = await import("@/components/portfolio/PortfolioRichTextEditor.vue");
    const editor = (wrapper.getComponent(RichEditor).vm as unknown as { editor: Editor }).editor;
    editor.commands.setContent({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "   ```java" }] }] });
    editor.commands.setTextSelection(11);
    await wrapper.get('[role="textbox"]').trigger("keydown", { key: "Enter" });
    expect(editor.isActive("codeBlock", { language: "java" })).toBe(true);
    editor.commands.insertContent('public class Demo { String name = "Codeiary"; }');
    await nextTick();
    expect(wrapper.find(".hljs-keyword").exists()).toBe(true);
    expect(wrapper.find(".hljs-string").exists()).toBe(true);
    const updates = wrapper.emitted("updateBlock")!;
    const java = updates[updates.length - 1]![1] as Partial<PortfolioBlock>;
    expect(java.content).toContain("```java");
    await wrapper.get('select[aria-label="코드 블록 언어"]').setValue("python");
    expect(editor.isActive("codeBlock", { language: "python" })).toBe(true);
    expect(wrapper.find('[aria-label="문단 스타일"], [aria-label="선택 글자 서식 초기화"]').exists()).toBe(false);
    await wrapper.setProps({ blocks: [{ ...block, ...java }], editable: false });
    await vi.waitFor(() => expect(wrapper.find("code.language-java .hljs-keyword").exists()).toBe(true));
    expect(wrapper.find('select[aria-label="코드 블록 언어"]').exists()).toBe(false);
  });

  it("기존 마크다운은 선택만으로 변경하지 않고 실제 글자 서식 편집 후 안전한 본문으로 바꾼다.", async () => {
    const source = '**원본** 설명 <img src=x onerror="alert(1)">';
    const block = createPortfolioBlock("markdown", { id: "legacy", content: source });
    const wrapper = mount(PortfolioDocument, {
      props: { post: postFixture(), blocks: [block], editable: true, selectedBlock: "legacy" },
    });
    wrappers.push(wrapper);
    await vi.waitFor(() => expect(wrapper.find('[contenteditable="true"]').exists()).toBe(true));
    expect(block.content).toBe(source);
    expect(block.type).toBe("markdown");
    expect(wrapper.emitted("updateBlock")).toBeUndefined();
    expect(wrapper.get('[role="textbox"]').text()).toBe('원본 설명');
    const { default: RichEditor } = await import("@/components/portfolio/PortfolioRichTextEditor.vue");
    const editor = (wrapper.getComponent(RichEditor).vm as unknown as { editor: Editor }).editor;
    editor.commands.setTextSelection({ from: 1, to: 3 });
    editor.commands.setColor("#336699");
    const updates = wrapper.emitted("updateBlock")!;
    const [id, patch] = updates[updates.length - 1] as [string, Partial<PortfolioBlock>];
    expect(id).toBe("legacy");
    expect(patch.type).toBe("markdown");
    expect(patch.content).toContain("**원본**");
    expect(patch.document?.content?.[0]?.content?.[0]?.marks).toEqual(expect.arrayContaining([
      { type: "bold" }, { type: "textStyle", attrs: { color: "#336699" } },
    ]));
    expect(block.content).toBe(source);
    await wrapper.setProps({ blocks: [{ ...block, ...patch }], editable: false });
    expect(wrapper.get('[data-block-id="legacy"] p').text()).toBe("원본 설명");
    expect(wrapper.find("img, script, [onerror]").exists()).toBe(false);
  });
});
