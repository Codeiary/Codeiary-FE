import type { BlogPost } from "./posts";

export const COMMENT_MAX_LENGTH = 2000;
export interface CommentAuthor {
  id: number;
  name: string;
  nickname?: string | null;
  profileImageUrl?: string | null;
}
export interface BlogComment {
  id: string;
  postKey: string;
  parentId: string | null;
  author: CommentAuthor | null;
  content: string;
  createdAt: string;
  updatedAt: string | null;
  deleted: boolean;
}
export function commentPostKey(post: Pick<BlogPost, "id" | "author">) {
  return `${post.author?.id ?? "legacy"}:${post.id}`;
}
export function commentThreads(comments: readonly BlogComment[]) {
  return comments
    .filter((comment) => comment.parentId === null)
    .map((root) => ({
      id: root.id,
      items: [
        root,
        ...comments.filter((comment) => comment.parentId === root.id),
      ],
    }))
    .filter((thread) => thread.items.some((comment) => !comment.deleted));
}
