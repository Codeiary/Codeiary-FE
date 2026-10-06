import type { BlogPost } from "@/utils/blog/posts";

export function postFixture(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    id: 1,
    author: { id: 1, name: "기록자" },
    status: "PUBLISHED",
    category: "개발 기록",
    title: "나의 Vue 기록",
    description: "직접 구현하며 배운 내용을 기록합니다.",
    date: "2026.10.06",
    createdAt: "2026-10-06T12:00:00+09:00",
    viewCount: 10,
    art: "code",
    tags: ["Vue"],
    ...overrides,
  };
}

export function blogPostsFixture(): BlogPost[] {
  return [
    postFixture({
      id: 5,
      author: null,
      title: "기존 예시 글",
      createdAt: "2026-10-01T12:00:00+09:00",
      viewCount: 200,
    }),
    postFixture({
      id: 2,
      author: { id: 2, name: "다른 기록자" },
      title: "다른 사람의 글",
      createdAt: "2026-10-02T12:00:00+09:00",
      viewCount: 200,
    }),
    postFixture({
      id: 3,
      title: "나의 비공개 글",
      visibility: "PRIVATE",
      category: "프론트엔드",
      tags: ["TypeScript"],
      createdAt: "2026-10-03T12:00:00+09:00",
      viewCount: 400,
    }),
    postFixture(),
    postFixture({
      id: 4,
      author: { id: 2, name: "다른 기록자" },
      title: "다른 사람의 비공개 글",
      visibility: "PRIVATE",
      createdAt: "2026-10-01T12:00:00+09:00",
      viewCount: 0,
    }),
  ];
}
