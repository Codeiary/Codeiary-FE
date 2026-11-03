import { describe, expect, it, vi } from "vitest";
import { contentFromEditorDocument } from "@/utils/portfolio/rich-text";
import { styledDocument, mapPortfolio, type ApiPortfolio } from "@/utils/portfolio/api-response";
import { portfolioPayload } from "@/utils/portfolio/api-payload";
import { portfolioFontFamily } from "@/utils/portfolio/fonts";

const authMock = vi.hoisted(() => ({ user: { value: null as { id: number } | null }, restore: vi.fn(async () => {}), authorizedRequest: vi.fn() }));
const request = vi.hoisted(() => vi.fn());
vi.mock("@/store/auth", () => ({ auth: authMock }));
vi.mock("@/services/auth-api", () => ({ createAuthApi: () => ({ request }) }));
import { fetchPortfolio, fetchPortfolioPage } from "@/services/portfolio-api";

const detail: ApiPortfolio = {
  id: 42, title: "**개발자**&#32;소개", titleAlign: "CENTER", titleStyles: [{ startOffset: 2, endOffset: 5, fontCode: "serif", fontSize: 40 }],
  author: { id: 7, nickname: "기록자" }, publicPortfolio: false, createdAt: "2026-11-03T10:00:00", defaultFontCode: "sans",
  blocks: [
    { id: 1, type: "TEXT", sortOrder: 0, x: 24, y: 10, widthPx: 500, heightPx: 90, textAlign: "RIGHT", content: "## 소개\n\n**개발😀** 과 문서",
      styles: [{ startOffset: 9, endOffset: 13, fontCode: "jua", fontSize: 22, textColor: "#336699" }] },
    { id: 2, type: "IMAGE", sortOrder: 1, x: 30, y: 150, widthPx: 300, heightPx: 200, imageUrl: "https://img.example.com/a.png", styles: [] },
  ],
};

describe("포트폴리오 조회 복원", () => {
  it("새로 받은 문서의 Markdown·제목 서식·이미지·픽셀 배치를 복원한다", () => {
    const item = mapPortfolio(detail);
    expect(item).toMatchObject({ id: 42, title: "개발자 소개", titleAlign: "center", visibility: "PRIVATE" });
    expect(item.titleRuns?.[0]).toMatchObject({ text: "개발자", font: "serif", size: 40, bold: true });
    expect(item.blocks?.[0]?.align).toBe("right");
    const body = contentFromEditorDocument(item.blocks![0]!.document!);
    expect(body.runs.find((run) => run.text.includes("개발😀"))).toMatchObject({ font: "jua", size: 22, color: "#336699", bold: true });
    expect(item.blocks?.[0]?.position?.width).toBeCloseTo(500 / (210 * 96 / 25.4 - 72) * 100);
    expect(item.blocks?.[1]).toMatchObject({ type: "image", imageUrl: detail.blocks[1]!.imageUrl, position: { y: 150, height: 200 } });
  });

  it("이스케이프·공백·이모지가 있는 텍스트의 저장과 조회 서식이 왕복한다", () => {
    const draft = { title: "제목", titleRuns: [], titleAlign: "left", visibility: "PUBLIC", blocks: [{ id: "a", type: "text" as const,
      align: "left" as const, content: "a*b 😀 x", runs: [{ text: "a*b 😀", color: "#123456", font: "serif" as const }, { text: " x" }] }] };
    const payload = portfolioPayload(draft, [{ id: 1, code: "sans" }, { id: 2, code: "serif" }], new Map([["a", { x: 0, y: 0, widthPx: 500, heightPx: 100 }]]));
    const block = payload.blocks[0]!;
    const doc = styledDocument(block.content!, block.styles!.map((style) => ({ ...style, fontCode: style.fontId === 2 ? "serif" : null })));
    const restored = contentFromEditorDocument(doc);
    expect(restored.content).toBe(draft.blocks[0]!.content);
    expect(restored.runs[0]).toMatchObject({ text: "a*b 😀", color: "#123456", font: "serif" });
  });

  it("코드 울타리의 언어와 코드 강조를 유지한다", () => {
    const source = "```java\nclass Test {}\n```";
    const doc = styledDocument(source, []);
    expect(doc.content?.[0]).toMatchObject({ type: "codeBlock", attrs: { language: "java" } });
    expect(doc.content?.[0]?.content?.[0]?.text).toBe("class Test {}");
    expect(portfolioFontFamily("jua")).toContain("Jua");
  });

  it("인증 복원 후 비공개 상세를 요청하고 내 목록은 서버 페이지를 그대로 사용한다", async () => {
    authMock.user.value = { id: 7 };
    authMock.authorizedRequest.mockResolvedValueOnce(detail);
    expect((await fetchPortfolio(42)).id).toBe(42);
    expect(authMock.restore).toHaveBeenCalled();
    expect(authMock.authorizedRequest).toHaveBeenCalledWith("/portfolios/42");
    authMock.authorizedRequest.mockResolvedValueOnce({ content: [detail], page: 2, totalPages: 9, totalElements: 49 });
    const page = await fetchPortfolioPage({ mine: true, page: 2, size: 6, search: "개발" });
    expect(page).toMatchObject({ page: 2, totalPages: 9, totalElements: 49 });
    expect(page.content).toHaveLength(1);
    expect(authMock.authorizedRequest).toHaveBeenLastCalledWith("/portfolios/mine?page=2&size=6&search=%EA%B0%9C%EB%B0%9C");
    authMock.user.value = null;
  });
});
