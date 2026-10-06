import type { ImageLayouts } from "@/utils/blog/image-layout";
export type PostVisibility = "PUBLIC" | "PRIVATE";

export interface BlogAuthor {
  id: number | `demo-${string}`;
  name: string;
  nickname?: string | null;
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
  viewCount: number;
  art: string;
  tags: string[];
  content?: string;
  slug?: string;
  updatedAt?: string;
  imageLayouts?: ImageLayouts;
  coverImage?: string;
  visibility?: PostVisibility;
}

// Demo identities are separate from real numeric account IDs. Replace this
// preview source with the posts API; never assign demo posts to signed-in users.
const demoAuthors: BlogAuthor[] = [
  { id: "demo-codeiary", name: "Codeiary" },
  { id: "demo-frontend", name: "프론트노트" },
];
export const demoPosts: readonly BlogPost[] = [
  {
    id: 1,
    category: "개발 기록",
    title: "화면이 아닌, 하나의 세계를 만든다는 것",
    description:
      "Three.js와 Vue로 작은 도시를 만들며 배운 것들. 인터랙션은 어떻게 경험이 되는 걸까?",
    date: "2026.10.04",
    viewCount: 128,
    art: "city",
    tags: ["Three.js", "Vue", "JavaScript"],
  },
  {
    id: 2,
    category: "프론트엔드",
    title: "좋은 인터랙션은 0.1초에서 시작된다",
    description: "작은 피드백과 자연스러운 움직임이 사용자 경험에 미치는 영향.",
    date: "2026.09.28",
    viewCount: 342,
    art: "motion",
    tags: ["UX", "Animation", "JavaScript"],
  },
  {
    id: 3,
    category: "개발 기록",
    title: "코드에 나만의 취향을 담는 방법",
    description: "읽기 좋은 코드와 오래 쓰고 싶은 제품에 대한 개인적인 생각.",
    date: "2026.09.21",
    viewCount: 96,
    art: "code",
    tags: ["Design", "Devlog"],
  },
  {
    id: 4,
    category: "프론트엔드",
    title: "Vue의 반응성을 조금 더 깊이 들여다보기",
    description: "ref, computed, watch를 상황에 맞게 사용하기 위한 기록.",
    date: "2026.09.15",
    viewCount: 215,
    art: "vue",
    tags: ["Vue", "TypeScript", "JavaScript"],
  },
].map((post, index) => ({
  ...post,
  createdAt: `${post.date.replace(/\./g, "-")}T00:00:00+09:00`,
  author: demoAuthors[index % demoAuthors.length]!,
  status: "PUBLISHED" as const,
}));
