import type { ImageLayouts } from "@/utils/blog/image-layout";
export type PostVisibility = "PUBLIC" | "PRIVATE";

export interface BlogAuthor {
  id: number | `demo-${string}`;
  name: string;
  nickname?: string | null;
  profileImageUrl?: string | null;
}

export interface BlogPost {
  id: number;
  author: BlogAuthor | null;
  status: "DRAFT" | "PUBLISHED";
  category: string;
  title: string;
  description: string;
  date: string;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
  art: string;
  tags: string[];
  content?: string;
  slug?: string;
  updatedAt?: string;
  imageLayouts?: ImageLayouts;
  coverImage?: string;
  visibility?: PostVisibility;
}
