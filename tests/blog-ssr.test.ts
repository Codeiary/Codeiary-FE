// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { render } from "@/entry-server";

function pageResponse(title = "서버에서 받은 공개 글") {
  return Response.json({
    content: [{
      id: 1, author: { id: 2, nickname: "기록자" }, title, category: "개발",
      publicPost: true, viewCount: 10, createdAt: "2026-10-09T00:00:00Z",
      representativeImageUrl: "https://img.codeiary.com/cover.jpg",
    }], page: 0, totalPages: 3, totalElements: 25,
  });
}

describe("블로그 첫 페이지 SSR", { timeout: 15_000 }, () => {
  it("브라우저 없이 공개 글과 링크를 HTML로 렌더링할 수 있다.", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(pageResponse());
    const page = await render("/blog", "http://localhost:8080/api", request);
    expect(page.html).toContain("서버에서 받은 공개 글");
    expect(page.html).toContain('href="/blog?page=2"');
    expect(page.html).toContain('class="post-open" href="/blog/');
    expect(page.html).toContain('src="https://img.codeiary.com/cover.jpg"');
    expect(page.robots).toBe("index, follow");
    expect(page.head).toContain('href="https://codeiary.com/blog"');
    const [url, init] = request.mock.calls[0]!;
    expect(String(url)).toContain("page=0&size=12&sort=LATEST");
    expect(init?.headers).toEqual({ Accept: "application/json" });
  });

  it("2페이지부터 API를 호출하지 않고 색인과 링크 탐색을 차단할 수 있다.", async () => {
    const request = vi.fn<typeof fetch>();
    const page = await render("/blog?page=2", "http://localhost:8080/api", request);
    expect(request).not.toHaveBeenCalled();
    expect(page.html).toBe("");
    expect(page.state).toBe("");
    expect(page.robots).toBe("noindex, nofollow");
    expect(page.head).toContain('href="https://codeiary.com/blog?page=2"');
  });

  it("동시 요청의 데이터를 분리하고 스크립트 문자열을 안전하게 전달할 수 있다.", async () => {
    const title = '</script><script>alert("x")</script>';
    const [first, second] = await Promise.all([
      render("/blog", "http://localhost:8080/api", vi.fn<typeof fetch>().mockResolvedValue(pageResponse(title))),
      render("/blog?q=다른글", "http://localhost:8080/api", vi.fn<typeof fetch>().mockResolvedValue(pageResponse("다른 요청의 글"))),
    ]);
    expect(first.state.match(/<\/script>/g)).toHaveLength(1);
    expect(first.html).not.toContain('<script>alert');
    expect(first.html).not.toContain("다른 요청의 글");
    expect(second.html).not.toContain("alert");
    expect(second.robots).toBe("noindex, nofollow");
  });

  it("API 장애를 빈 목록의 정상 응답으로 처리하지 않을 수 있다.", async () => {
    await expect(render("/blog", "http://localhost:8080/api",
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }))))
      .rejects.toThrow("503");
  });
});
