import { postSlug } from "@/utils/blog/slug";
export function portfolioRoute(item: { id: number; title: string }, view = false) {
  return { name: view ? "portfolio-view" : "portfolio-detail",
    params: { portfolioSlug: postSlug(item.title) || "portfolio", portfolioId: String(item.id) } };
}
