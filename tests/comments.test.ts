// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createComment,
  deleteComment,
  readComments,
  updateComment,
} from "@/services/comment-storage";
import { commentPostKey, commentThreads } from "@/utils/blog/comments";
import { commentAuthorFixture } from "./fixtures/comments";
import { postFixture } from "./fixtures/blog";

beforeEach(() => deleteDB("codeiary.comments.mock.v1"));
const key = commentPostKey(postFixture());

describe("댓글 저장", () => {
  it("같은 사용자가 여러 댓글과 이모지를 작성하고 다시 불러올 수 있다.", async () => {
    const author = commentAuthorFixture({
      profileImageUrl: "https://example.com/avatar.png",
    });
    const first = await createComment(
      key,
      author,
      "  좋은 글이에요 🎉\n감사합니다.  ",
    );
    const second = await createComment(key, author, "다시 읽어봤어요 👍");
    const comments = await readComments(key);
    expect(comments).toHaveLength(2);
    expect(comments).toContainEqual(
      expect.objectContaining({
        id: first.id,
        content: "좋은 글이에요 🎉\n감사합니다.",
        author: expect.objectContaining({
          nickname: author.nickname,
          profileImageUrl: author.profileImageUrl,
        }),
        updatedAt: null,
      }),
    );
    expect(new Date(second.createdAt).getTime()).not.toBeNaN();
  });
  it("다른 사용자의 댓글을 관리자도 수정하거나 삭제하지 못하도록 할 수 있다.", async () => {
    const owner = commentAuthorFixture();
    const comment = await createComment(key, owner, "원본");
    const other = {
      ...commentAuthorFixture({ id: 2 }),
      role: "ADMIN" as const,
    };
    await expect(updateComment(key, comment.id, other, "변경")).rejects.toThrow(
      "내가 작성한 댓글만",
    );
    await expect(deleteComment(key, comment.id, other)).rejects.toThrow(
      "내가 작성한 댓글만",
    );
    const updated = await updateComment(key, comment.id, owner, "수정한 글 ✨");
    expect(updated.createdAt).toBe(comment.createdAt);
    expect(updated.updatedAt).not.toBeNull();
    expect(updated.content).toBe("수정한 글 ✨");
  });
  it("답글은 같은 글의 원댓글에만 한 단계로 작성할 수 있다.", async () => {
    const author = commentAuthorFixture();
    const root = await createComment(key, author, "댓글");
    const reply = await createComment(key, author, "답글", root.id);
    await expect(
      createComment(key, author, "두 단계", reply.id),
    ).rejects.toThrow("답글을 남길 수 없는");
    await expect(
      createComment("other:1", author, "다른 글", root.id),
    ).rejects.toThrow("답글을 남길 수 없는");
    await expect(
      createComment(key, author, "없는 댓글", "missing"),
    ).rejects.toThrow("답글을 남길 수 없는");
    expect(
      commentThreads(await readComments(key))[0]?.items.map((item) => item.id),
    ).toEqual([root.id, reply.id]);
  });
  it("원댓글을 삭제해도 다른 사용자의 답글을 유지하고 삭제 내용과 작성자를 지울 수 있다.", async () => {
    const owner = commentAuthorFixture();
    const other = commentAuthorFixture({ id: 2 });
    const root = await createComment(key, owner, "지워야 하는 내용");
    const reply = await createComment(key, other, "남겨야 하는 답글", root.id);
    await deleteComment(key, root.id, owner);
    const threads = commentThreads(await readComments(key));
    expect(threads[0]?.items[0]).toMatchObject({
      deleted: true,
      author: null,
      content: "",
    });
    expect(threads[0]?.items[1]).toEqual(reply);
    await expect(updateComment(key, root.id, owner, "복구")).rejects.toThrow();
    await expect(
      createComment(key, other, "새 답글", root.id),
    ).rejects.toThrow();
    await deleteComment(key, reply.id, other);
    expect(commentThreads(await readComments(key))).toEqual([]);
  });
  it("로그인하지 않았거나 비어 있거나 너무 긴 댓글을 저장하지 않을 수 있다.", async () => {
    const author = commentAuthorFixture();
    await expect(createComment(key, null, "댓글")).rejects.toThrow("로그인");
    await expect(createComment(key, author, " \n ")).rejects.toThrow("내용");
    await expect(createComment(key, author, "가".repeat(2001))).rejects.toThrow(
      "2,000",
    );
    expect(await readComments(key)).toEqual([]);
  });
  it("예시 글과 실제 글의 번호가 같아도 댓글을 분리할 수 있다.", async () => {
    const demoKey = commentPostKey(
      postFixture({ author: { id: "demo-codeiary", name: "Codeiary" } }),
    );
    const comment = await createComment(
      demoKey,
      commentAuthorFixture(),
      "예시 글 댓글",
    );
    expect(await readComments(key)).toEqual([]);
    expect(await readComments(demoKey)).toEqual([comment]);
    await expect(
      deleteComment(key, comment.id, commentAuthorFixture()),
    ).rejects.toThrow();
  });
});
