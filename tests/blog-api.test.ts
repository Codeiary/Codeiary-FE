import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPost, updatePost, fetchPostPage, fetchMyPostCount, type PostInput } from "@/services/blog-api";

const requests = vi.hoisted(() => ({ public: vi.fn(), authorized: vi.fn() }));
vi.mock("@/services/auth-api", () => ({ createAuthApi: () => ({ request: requests.public }) }));
vi.mock("@/store/auth", () => ({ auth: { authorizedRequest: requests.authorized } }));

const input: PostInput = {
  title: "관계 매핑", content: "# 본문", category: "Java", tags: ["java", "spring"], publicPost: true,
};
const response = {
  ...input, id: 10, author: { id: 1, nickname: "기록자" },
  createdAt: "2026-10-09T00:00:00Z", likeCount: 0, likedByMe: false,
};

describe("게시글 태그 API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("생성과 수정 요청에 태그를 포함하고 저장된 태그를 반환할 수 있다.", async () => {
    requests.authorized.mockResolvedValue(response);
    const created = await createPost(input);
    const updated = await updatePost(10, input);
    expect(created.tags).toEqual(input.tags);
    expect(updated.tags).toEqual(input.tags);
    expect(requests.authorized).toHaveBeenNthCalledWith(1, "/posts", expect.objectContaining({
      method: "POST", body: JSON.stringify(input),
    }));
    expect(requests.authorized).toHaveBeenNthCalledWith(2, "/posts/10", expect.objectContaining({
      method: "PUT", body: JSON.stringify(input),
    }));
  });

  it("태그 검색 조건을 전달하고 목록의 태그를 표시할 수 있다.", async () => {
    requests.public.mockResolvedValue({ content: [response], page: 0, totalPages: 1, totalElements: 1 });
    const page = await fetchPostPage({ page: 0, tag: "spring" });
    expect(requests.public).toHaveBeenCalledWith("/posts?tag=spring&page=0&size=12");
    expect(page.content[0]?.tags).toEqual(input.tags);
  });

  it("내 게시글 전체 수를 작은 페이지 조회로 확인할 수 있다.", async () => {
    requests.authorized.mockResolvedValue({ content: [], page: 0, totalPages: 24, totalElements: 237 });
    await expect(fetchMyPostCount()).resolves.toBe(237);
    expect(requests.authorized).toHaveBeenCalledWith("/posts/mine?page=0&size=1");
  });
});
