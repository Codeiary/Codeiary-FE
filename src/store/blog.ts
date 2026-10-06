import { shallowRef } from "vue";
import type { BlogPost } from "@/utils/blog/posts";
import {
  deletePost as removePost,
  publishDraft as savePublishedDraft,
  readPosts,
  type BlogDraft,
} from "@/services/blog-storage";

export const localPosts = shallowRef<BlogPost[]>([]);

export async function loadLocalPosts() {
  localPosts.value = await readPosts();
  return localPosts.value;
}

export async function publishDraft(draft: BlogDraft) {
  const post = await savePublishedDraft(draft);
  localPosts.value = [
    ...localPosts.value.filter((item) => item.id !== post.id),
    post,
  ];
  return post;
}

export async function deletePost(postId: number, authorId: number) {
  await removePost(postId, authorId);
  localPosts.value = localPosts.value.filter((item) => item.id !== postId);
}
