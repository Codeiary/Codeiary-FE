import { auth } from "@/store/auth";
import { createAuthApi } from "@/services/auth-api";
import type { Comment } from "@/utils/blog/comments";

type Request = <T>(path: string, init?: RequestInit) => Promise<T>;

export function createCommentApi(options: {
  fetch?: typeof fetch;
  baseUrl?: string;
  authorizedRequest?: Request;
} = {}) {
  const publicApi = createAuthApi(options);
  const authorizedRequest = options.authorizedRequest ?? auth.authorizedRequest;

  function readComments(postId: number) {
    return publicApi.request<Comment[]>(`/posts/${postId}/comments`);
  }

  function createComment(postId: number, content: string, parentId: number | null = null) {
    return authorizedRequest<Comment>(`/posts/${postId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, parentId }),
    });
  }

  function updateComment(postId: number, commentId: number, content: string) {
    return authorizedRequest<Comment>(`/posts/${postId}/comments/${commentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  }

  function deleteComment(postId: number, commentId: number) {
    return authorizedRequest<void>(`/posts/${postId}/comments/${commentId}`, {
      method: "DELETE",
    });
  }

  return { readComments, createComment, updateComment, deleteComment };
}

const api = createCommentApi();
export const readComments = api.readComments;
export const createComment = api.createComment;
export const updateComment = api.updateComment;
export const deleteComment = api.deleteComment;
