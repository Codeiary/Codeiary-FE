import { ref } from "vue";
import type { BlogAuthor } from "@/utils/blog/posts";
import type { PortfolioBlock, PortfolioTextRun } from "@/utils/portfolio/layout";

export interface PortfolioItem {
  id: number;
  author: BlogAuthor;
  title: string;
  titleRuns?: PortfolioTextRun[];
  titleAlign?: "left" | "center" | "right";
  summary: string;
  content: string;
  blocks?: PortfolioBlock[];
  coverImage?: string;
  visibility: "PUBLIC" | "PRIVATE";
}

export const portfolios = ref<PortfolioItem[]>([]);
