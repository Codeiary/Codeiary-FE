import type { InjectionKey } from "vue";
import type { BlogPost } from "@/utils/blog/posts";

export const BLOG_PAGE_SIZE = 12;

export interface BlogPage {
  content: BlogPost[];
  page: number;
  totalPages: number;
  totalElements: number;
}

export interface BlogBootstrap {
  url: string;
  page: BlogPage;
}

export const blogBootstrapKey: InjectionKey<BlogBootstrap | undefined> = Symbol("blog-bootstrap");

export function blogPageNumber(value: unknown): number {
  const page = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : 1;
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function blogSeo(url: URL) {
  const page = blogPageNumber(url.searchParams.get("page"));
  const filtered = ["q", "category", "tag", "sort"].some((key) => Boolean(url.searchParams.get(key)));
  const canonical = new URL("https://codeiary.com/blog");
  if (page > 1) canonical.searchParams.set("page", String(page));
  for (const key of ["q", "category", "tag", "sort"]) {
    const value = url.searchParams.get(key);
    if (value) canonical.searchParams.set(key, value);
  }
  return {
    page,
    robots: page > 1 || filtered ? "noindex, nofollow" : "index, follow",
    canonical: canonical.href,
    title: page > 1 ? `Blog House · ${page}페이지 — Codeiary` : "Blog House — Codeiary",
  };
}
