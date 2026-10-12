import type { BlogPost } from "@/utils/blog/posts";

// Hand the write response to the next page once; do not persist private content.
let saved: { post: BlogPost; at: number } | undefined;

export function rememberSavedPost(post: BlogPost) {
  saved = { post, at: Date.now() };
}

export function takeSavedPost(postId: number | undefined, userId: number | undefined) {
  const entry = saved;
  saved = undefined;
  return entry && Date.now() - entry.at < 30_000
    && entry.post.id === postId && entry.post.author?.id === userId
    ? entry.post : undefined;
}
