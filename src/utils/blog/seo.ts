import type { RouteLocationNormalized } from "vue-router";
import { blogSeo } from "@/utils/blog/page";

export function updatePageSeo(route: RouteLocationNormalized) {
  const blog = route.name === "blog" ? blogSeo(new URL(route.fullPath, window.location.origin)) : undefined;
  document.title = blog?.title ?? String(route.meta.title || "Codeiary");
  let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!blog) {
    robots?.remove();
    canonical?.remove();
    return;
  }
  if (!robots) {
    robots = document.createElement("meta");
    robots.name = "robots";
    document.head.append(robots);
  }
  robots.content = blog.robots;
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.append(canonical);
  }
  canonical.href = blog.canonical;
}
