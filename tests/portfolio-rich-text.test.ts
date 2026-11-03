import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { portfolioFontFamily } from "@/utils/portfolio/fonts";
import {
  contentFromEditorDocument,
  normalizeTextRuns,
  runsToEditorDocument,
  textRunStyle,
} from "@/utils/portfolio/rich-text";

describe("포트폴리오 글자별 서식", () => {
  it("실제 Tiptap에서 선택한 글자의 크기·색·글꼴을 함께 저장하고 복원한다", () => {
    const extensions = () => [
      StarterKit.configure({
        blockquote: false, bulletList: false, orderedList: false, listItem: false,
        listKeymap: false, code: false, codeBlock: false, heading: false,
        horizontalRule: false, strike: false, underline: false, link: false,
        dropcursor: false, gapcursor: false, trailingNode: false,
      }),
      TextStyleKit.configure({ backgroundColor: false, lineHeight: false }),
    ];
    const editor = new Editor({ extensions: extensions(), content: runsToEditorDocument("가나다라마") });
    let restored: Editor | undefined;
    try {
      expect(editor.chain().setTextSelection({ from: 1, to: 4 })
        .setFontSize("32px").setColor("#c54e32")
        .setFontFamily(portfolioFontFamily("jua")).run()).toBe(true);
      const saved = contentFromEditorDocument(editor.getJSON());
      expect(saved).toEqual({ content: "가나다라마", runs: [
        { text: "가나다", font: "jua", size: 32, color: "#c54e32" }, { text: "라마" },
      ] });
      restored = new Editor({ extensions: extensions(), content: runsToEditorDocument(saved.content, saved.runs) });
      restored.commands.setTextSelection({ from: 1, to: 4 });
      expect(restored.getAttributes("textStyle")).toMatchObject({
        fontFamily: portfolioFontFamily("jua"), fontSize: "32px", color: "#c54e32",
      });
      const styledText = restored.view.dom.querySelector<HTMLSpanElement>("span");
      expect(styledText?.textContent).toBe("가나다");
      expect(styledText?.style.fontSize).toBe("32px");
      expect(["#c54e32", "rgb(197, 78, 50)"]).toContain(styledText?.style.color);
      expect(styledText?.style.fontFamily).toContain("Jua");
      expect(contentFromEditorDocument(restored.getJSON())).toEqual(saved);
    } finally {
      editor.destroy();
      restored?.destroy();
    }
  });

  it("본문과 맞지 않는 오래된 서식이 삭제한 글자를 되살리지 않는다", () => {
    expect(normalizeTextRuns([{ text: "이전 본문", bold: true }], "현재 본문")).toEqual([{ text: "현재 본문" }]);
    expect(normalizeTextRuns([{ text: 42 }], "본문")).toEqual([{ text: "본문" }]);
    expect(normalizeTextRuns(undefined, "")).toEqual([{ text: "" }]);
  });

  it("붙여넣은 알 수 없는 서식이나 HTML 속성은 버리고 텍스트는 보존한다", () => {
    const result = contentFromEditorDocument({ type: "doc", content: [{ type: "paragraph", attrs: { onclick: "alert(1)" }, content: [
      { type: "text", text: "<script>그대로</script>", marks: [
        { type: "link", attrs: { href: "javascript:alert(1)" } },
        { type: "textStyle", attrs: { fontFamily: "url(https://evil.test)", color: "red;display:none", fontSize: "1000px" } },
      ] },
      { type: "text", text: " 정상", marks: [{ type: "textStyle", attrs: { fontFamily: portfolioFontFamily("gowun-dodum"), color: "#123ABC", fontSize: "18px" } }] },
    ] }] });
    expect(result.runs).toEqual([
      { text: "<script>그대로</script>" }, { text: " 정상", font: "gowun-dodum", color: "#123abc", size: 18 },
    ]);
    expect(textRunStyle({ font: "unknown", color: "#abc", size: Infinity, bold: "yes", italic: false })).toEqual({});
    expect(textRunStyle({ size: 9 })).toEqual({});
    expect(textRunStyle({ size: 97 })).toEqual({});
    expect(textRunStyle({ size: 10 })).toEqual({ fontSize: "10px" });
    expect(textRunStyle({ size: 96 })).toEqual({ fontSize: "96px" });
  });

  it("문단, 한 줄 바꿈, 빈 문단을 구분해서 왕복한다", () => {
    const source = { type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "첫 줄" }, { type: "hardBreak" }, { type: "text", text: "다음 줄", marks: [{ type: "bold" }] }] },
      { type: "paragraph", content: [] },
      { type: "paragraph", content: [{ type: "text", text: "끝" }] },
    ] };
    const result = contentFromEditorDocument(source);
    expect(result.content).toBe("첫 줄\n다음 줄\n\n\n\n끝");
    const document = runsToEditorDocument(result.content, result.runs);
    expect(document.content).toHaveLength(3);
    expect(document.content[0]?.content.some((node) => node.type === "hardBreak")).toBe(true);
    expect(document.content[1]?.content).toEqual([]);
    expect(contentFromEditorDocument(document)).toEqual(result);
  });
});
