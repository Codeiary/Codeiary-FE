import { describe, expect, it, vi } from "vitest";
import { createCommentApi } from "@/services/comment-api";
import { commentThreads, type Comment } from "@/utils/blog/comments";

const comment: Comment = {
  id: 10,
  targetType: "BLOG_POST",
  targetId: 25,
  parentId: null,
  author: { id: 3, name: "기록자", nickname: "기록자", profileImageUrl: null },
  content: "좋은 글이에요 🎉",
  createdAt: "2026-10-10T12:00:00",
  updatedAt: null,
  deleted: false,
};

describe("댓글 API", () => {
  it("비로그인 사용자도 게시글 댓글을 조회할 수 있다.", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify([comment]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const api = createCommentApi({ fetch, baseUrl: "https://api.example.com/api" });

    await expect(api.readComments(25)).resolves.toEqual([comment]);
    expect(fetch).toHaveBeenCalledWith(
      "https://api.example.com/api/posts/25/comments",
      expect.objectContaining({ credentials: "include", cache: "no-store" }),
    );
  });

  it("댓글 작성·수정·삭제를 쿠키 인증 API에 위임할 수 있다.", async () => {
    const requests: Array<{ path: string; init?: RequestInit }> = [];
    const authorizedRequest = async <T>(path: string, init?: RequestInit): Promise<T> => {
      requests.push({ path, init });
      return comment as T;
    };
    const api = createCommentApi({ authorizedRequest });

    await api.createComment(25, "답글 🎉", 10);
    await api.updateComment(25, 10, "수정한 댓글");
    await api.deleteComment(25, 10);

    expect(requests.map(({ path, init }) => [path, init?.method])).toEqual([
      ["/posts/25/comments", "POST"],
      ["/posts/25/comments/10", "PUT"],
      ["/posts/25/comments/10", "DELETE"],
    ]);
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({ content: "답글 🎉", parentId: 10 });
    expect(JSON.parse(String(requests[1]?.init?.body))).toEqual({ content: "수정한 댓글" });
  });

  it("삭제된 원댓글을 남겨 답글의 계층을 유지할 수 있다.", () => {
    const reply: Comment = { ...comment, id: 11, parentId: 10, content: "답글" };
    const deletedRoot: Comment = { ...comment, author: null, content: "", deleted: true };

    expect(commentThreads([deletedRoot, reply])).toEqual([
      { id: deletedRoot.id, items: [deletedRoot, reply] },
    ]);
  });
});
