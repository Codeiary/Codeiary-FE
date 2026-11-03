import { describe, expect, it, vi } from "vitest";
import { portfolioPayload, measurePortfolioBlocks } from "@/utils/portfolio/api-payload";
import { portfolioFontFamily } from "@/utils/portfolio/fonts";
import { createPortfolio, updatePortfolio, removePortfolio } from "@/services/portfolio-api";
import { auth } from "@/store/auth";

vi.mock("@/store/auth", () => ({ auth: { authorizedRequest: vi.fn(async () => ({ id: 901 })) } }));
const fonts = [{ id: 8, code: "sans" }, { id: 25, code: "serif" }];

describe("포트폴리오 저장 요청", () => {
  it("제목·Markdown의 실제 문자 범위와 DB 글꼴 ID를 보내고 이미지를 분리한다", () => {
    const content = "## 소개\n\n**개발😀**과 문서";
    const payload = portfolioPayload({
      title: "개발자 소개", titleAlign: "center", titleRuns: [{ text: "개발자", font: "serif", size: 40 }, { text: " 소개" }],
      visibility: "PRIVATE", coverImage: "https://img.example.com/cover.png",
      blocks: [
        { id: "text", type: "markdown", align: "right", content,
          document: { type: "doc", content: [
            { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "소개" }] },
            { type: "paragraph", content: [
              { type: "text", text: "개발😀", marks: [{ type: "bold" }, { type: "textStyle", attrs: { fontFamily: portfolioFontFamily("serif"), color: "#123456", fontSize: "20.5px" } }] },
              { type: "text", text: "과 문서" },
            ] },
          ] } },
        { id: "image", type: "image", content: "", align: "left", imageUrl: "https://img.example.com/a.png", alt: "구성도" },
      ],
    }, fonts, new Map(["text", "image"].map((id) => [id, { x: 12.5, y: 24, widthPx: 500, heightPx: 100 }])));
    expect(payload.defaultFontId).toBe(8);
    expect(payload.titleAlign).toBe("CENTER");
    expect(payload.titleStyles).toEqual([{ startOffset: 0, endOffset: 3, fontId: 25, fontSize: 40 }]);
    expect(payload.publicPortfolio).toBe(false);
    expect(payload.blocks[0]).toMatchObject({ type: "TEXT", content, textAlign: "RIGHT", x: 12.5 });
    const style = payload.blocks[0]!.styles![0]!;
    expect(content.slice(style.startOffset, style.endOffset)).toBe("개발😀");
    expect(style).toMatchObject({ fontId: 25, fontSize: 20.5, textColor: "#123456" });
    expect(payload.blocks[1]).toMatchObject({ type: "IMAGE", imageUrl: "https://img.example.com/a.png", heightPx: 100 });
  });

  it("화면에서 렌더링된 블록의 좌표·너비·자동 높이를 픽셀로 측정한다", async () => {
    const canvas = document.createElement("div");
    canvas.innerHTML = '<div class="portfolio-document-blocks"><div class="portfolio-document-block" data-block-id="a"></div></div>';
    vi.spyOn(canvas.firstElementChild!, "getBoundingClientRect").mockReturnValue({ left: 100, top: 200, width: 600 } as DOMRect);
    vi.spyOn(canvas.querySelector("[data-block-id]")!, "getBoundingClientRect").mockReturnValue({ left: 160, top: 240, width: 300, height: 120 } as DOMRect);
    const result = await measurePortfolioBlocks(canvas, [{ id: "a", type: "text", content: "", align: "left" }]);
    expect(result.get("a")).toEqual({ x: 60, y: 40, widthPx: 300, heightPx: 120 });
  });

  it("강조와 공백이 섞인 제목의 Markdown과 글자 스타일을 함께 보존한다", () => {
    const result = portfolioPayload({
      title: "개발자 소개", titleAlign: "left", visibility: "PUBLIC", blocks: [],
      titleRuns: [{ text: "개발자 ", bold: true, font: "serif" }, { text: "소개", color: "#123456" }],
    }, fonts, new Map());
    expect(result.title).toBe("**개발자**&#32;소개");
    const ranges = result.titleStyles;
    expect(result.title.slice(ranges[0]!.startOffset, ranges[0]!.endOffset)).toBe("개발자");
    expect(ranges[0]!.fontId).toBe(25);
    const last = ranges[ranges.length - 1]!;
    expect(result.title.slice(last.startOffset, last.endOffset)).toBe("소개");
  });

  it("인증 요청으로 서버에 저장하고 반환된 ID를 사용한다", async () => {
    const input = { title: "제목", titleAlign: "LEFT", titleStyles: [], defaultFontId: 8, publicPortfolio: true, blocks: [] };
    expect(await createPortfolio(input)).toEqual({ id: 901 });
    expect(auth.authorizedRequest).toHaveBeenCalledWith("/portfolios", expect.objectContaining({ method: "POST", body: JSON.stringify(input) }));
  });
  it("수정과 삭제를 동일한 서버 ID의 인증 API로 보낸다", async () => {
    const input = { title: "수정", titleAlign: "LEFT", titleStyles: [], defaultFontId: 8, publicPortfolio: false, blocks: [] };
    await updatePortfolio(42, input);
    expect(auth.authorizedRequest).toHaveBeenLastCalledWith("/portfolios/42", expect.objectContaining({ method: "PUT", body: JSON.stringify(input) }));
    await removePortfolio(42);
    expect(auth.authorizedRequest).toHaveBeenLastCalledWith("/portfolios/42", { method: "DELETE" });
  });

});
