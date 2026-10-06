import { openDB, type DBSchema } from "idb";
import {
  COMMENT_MAX_LENGTH,
  type BlogComment,
  type CommentAuthor,
} from "@/utils/blog/comments";

interface CommentDatabase extends DBSchema {
  comments: { key: string; value: BlogComment; indexes: { postKey: string } };
}
// Frontend mock repository; replace with the comments API when it is available.
function database() {
  return openDB<CommentDatabase>("codeiary.comments.mock.v1", 1, {
    upgrade(db) {
      db.createObjectStore("comments", { keyPath: "id" }).createIndex(
        "postKey",
        "postKey",
      );
    },
  });
}
function signedIn(actor: CommentAuthor | null): CommentAuthor {
  if (!actor) throw new Error("로그인 후 댓글을 작성해 주세요.");
  return actor;
}
function body(content: string) {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("댓글 내용을 입력해 주세요.");
  if (trimmed.length > COMMENT_MAX_LENGTH)
    throw new Error(
      `댓글은 ${COMMENT_MAX_LENGTH.toLocaleString()}자까지 작성할 수 있어요.`,
    );
  return trimmed;
}
export async function readComments(postKey: string) {
  const db = await database();
  try {
    return (await db.getAllFromIndex("comments", "postKey", postKey)).sort(
      (a, b) =>
        a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
  } finally {
    db.close();
  }
}
export async function createComment(
  postKey: string,
  actor: CommentAuthor | null,
  content: string,
  parentId: string | null = null,
) {
  const user = signedIn(actor);
  const text = body(content);
  const db = await database();
  try {
    const tx = db.transaction("comments", "readwrite");
    if (parentId) {
      const parent = await tx.store.get(parentId);
      if (
        !parent ||
        parent.postKey !== postKey ||
        parent.parentId !== null ||
        parent.deleted
      ) {
        await tx.done;
        throw new Error(
          "답글을 남길 수 없는 댓글이에요. 새로고침 후 확인해 주세요.",
        );
      }
    }
    const comment: BlogComment = {
      id: crypto.randomUUID(),
      postKey,
      parentId,
      author: {
        id: user.id,
        name: user.name,
        nickname: user.nickname,
        profileImageUrl: user.profileImageUrl,
      },
      content: text,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      deleted: false,
    };
    await tx.store.add(comment);
    await tx.done;
    return comment;
  } finally {
    db.close();
  }
}
export async function updateComment(
  postKey: string,
  id: string,
  actor: CommentAuthor | null,
  content: string,
) {
  const user = signedIn(actor);
  const text = body(content);
  const db = await database();
  try {
    const tx = db.transaction("comments", "readwrite");
    const comment = await tx.store.get(id);
    if (
      !comment ||
      comment.postKey !== postKey ||
      comment.deleted ||
      comment.author?.id !== user.id
    ) {
      await tx.done;
      throw new Error("내가 작성한 댓글만 수정할 수 있어요.");
    }
    const updated = {
      ...comment,
      content: text,
      updatedAt: new Date().toISOString(),
    };
    await tx.store.put(updated);
    await tx.done;
    return updated;
  } finally {
    db.close();
  }
}
export async function deleteComment(
  postKey: string,
  id: string,
  actor: CommentAuthor | null,
) {
  const user = signedIn(actor);
  const db = await database();
  try {
    const tx = db.transaction("comments", "readwrite");
    const comment = await tx.store.get(id);
    if (
      !comment ||
      comment.postKey !== postKey ||
      comment.deleted ||
      comment.author?.id !== user.id
    ) {
      await tx.done;
      throw new Error("내가 작성한 댓글만 삭제할 수 있어요.");
    }
    // Retain the thread anchor without retaining deleted text or identity.
    await tx.store.put({
      ...comment,
      content: "",
      author: null,
      deleted: true,
    });
    await tx.done;
  } finally {
    db.close();
  }
}
