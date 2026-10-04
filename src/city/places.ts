import type { Point } from "./navigation";

export type Destination = "blog" | "portfolio" | "news";
export const places: Record<
  Destination,
  {
    name: string;
    english: string;
    color: string;
    x: number;
    z: number;
    height: number;
    entrance: Point;
  }
> = {
  blog: {
    name: "블로그 하우스",
    english: "BLOG HOUSE",
    color: "#e77153",
    x: -18,
    z: -6,
    height: 13,
    entrance: { x: -18, z: 2 },
  },
  portfolio: {
    name: "포트폴리오 갤러리",
    english: "THE GALLERY",
    color: "#398f86",
    x: 5,
    z: -28,
    height: 18,
    entrance: { x: 5, z: -19 },
  },
  news: {
    name: "IT 뉴스 타워",
    english: "NEWS TOWER",
    color: "#c69936",
    x: 30,
    z: -10,
    height: 24,
    entrance: { x: 30, z: -1 },
  },
};
