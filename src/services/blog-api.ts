import { createAuthApi } from "@/services/auth-api";
import { auth } from "@/store/auth";
import { postSlug } from "@/utils/blog/slug";
import type { BlogAuthor, BlogPost } from "@/utils/blog/posts";
import { BLOG_PAGE_SIZE, type BlogPage } from "@/utils/blog/page";

interface ApiAuthor { id: number; nickname?: string | null; profileImageUrl?: string | null }
interface ApiPost {
  id: number;
  author: ApiAuthor;
  title: string;
  content?: string;
  category: string;
  tags?: string[];
  representativeImageUrl?: string | null;
  publicPost: boolean;
  viewCount: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ApiPostPage {
  content: ApiPost[];
  page: number;
  totalPages: number;
  totalElements: number;
}

export function mapPostPage(page: ApiPostPage): BlogPage {
  return { ...page, content: page.content.filter((post) => post.publicPost).map(mapPost) };
}

const api = createAuthApi();

function authorOf(author: ApiAuthor): BlogAuthor {
  const nickname = author.nickname?.trim() || "사용자";
  return { id: author.id, name: nickname, nickname, profileImageUrl: author.profileImageUrl ?? null };
}

export function mapPost(post: ApiPost): BlogPost {
  const content = post.content ?? "";
  return {
    id: post.id,
    author: authorOf(post.author),
    status: "PUBLISHED",
    category: post.category,
    title: post.title,
    description: content.replace(/[#*`>$|_~]/g, "").replace(/\s+/g, " ").trim().slice(0, 150),
    date: new Date(post.createdAt).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }).replace(/-/g, "."),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    viewCount: post.viewCount ?? 0,
    art: "code",
    tags: post.tags ?? [],
    content: post.content,
    slug: postSlug(post.title),
    coverImage: post.representativeImageUrl ?? undefined,
    visibility: post.publicPost ? "PUBLIC" : "PRIVATE",
  };
}

function query(params: { search?: string; category?: string; tag?: string; sort?: "LATEST" | "VIEWS"; page?: number; size?: number }) {
  const values = new URLSearchParams();
  if (params.search) values.set("search", params.search);
  if (params.category) values.set("category", params.category);
  if (params.tag) values.set("tag", params.tag);
  if (params.sort) values.set("sort", params.sort);
  values.set("page", String(params.page ?? 0));
  values.set("size", String(params.size ?? 100));
  return `?${values}`;
}

export async function fetchPosts(params: { mine?: boolean; search?: string; category?: string; tag?: string; sort?: "LATEST" | "VIEWS"; page?: number; size?: number } = {}) {
  const path = `${params.mine ? "/posts/mine" : "/posts"}${query(params)}`;
  const response = params.mine
    ? await auth.authorizedRequest<{ content: ApiPost[] }>(path)
    : await api.request<{ content: ApiPost[] }>(path);
  return response.content.map(mapPost);
}

export async function fetchPostPage(params: { search?: string; tag?: string; sort?: "LATEST" | "VIEWS"; page: number }) {
  return mapPostPage(await api.request<ApiPostPage>(`/posts${query({ ...params, size: BLOG_PAGE_SIZE })}`));
}

export async function fetchPost(id: number) {
  return mapPost(await api.request<ApiPost>(`/posts/${id}`));
}

export interface PostInput {
  title: string;
  content: string;
  category: string;
  tags: string[];
  representativeImageUrl?: string | null;
  publicPost: boolean;
}

export async function createPost(input: PostInput) {
  return mapPost(await auth.authorizedRequest<ApiPost>("/posts", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  }));
}

export async function updatePost(id: number, input: PostInput) {
  return mapPost(await auth.authorizedRequest<ApiPost>(`/posts/${id}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  }));
}

export function removePost(id: number) {
  return auth.authorizedRequest<void>(`/posts/${id}`, { method: "DELETE" });
}
