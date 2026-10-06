import type { UserProfile } from "@/store/auth";
import type { BlogAuthor, BlogPost } from "@/utils/blog/posts";

export interface HomeEntry {
  id: string;
  title: string;
  description: string;
  category: string;
  date: string;
  tags: string[];
  paragraphs: string[];
}
export interface HomeProfile {
  owner: BlogAuthor;
  email: string;
  github: string;
  projects: HomeEntry[];
  issues: HomeEntry[];
}

// Frontend presentation fixtures. They are never written to an account or API.
// Existing blog posts keep their original author and visibility.
export function createMockHome(user: UserProfile | null): HomeProfile {
  return {
    owner: user
      ? { id: user.id, name: user.name, nickname: user.nickname }
      : { id: "demo-codeiary", name: "Codeiary" },
    email: user?.email ?? "dnjstjt1297@gmail.com",
    github: "https://github.com/dnjstjt1297",
    projects: [
      {
        id: "codeiary",
        title: "Codeiary",
        category: "Web",
        date: "2026.10.06",
        description: "걷고, 발견하고, 기록하는 나만의 3D 블로그.",
        tags: ["Vue", "TypeScript", "Three.js"],
        paragraphs: [
          "블로그와 포트폴리오를 작은 도시 안에서 탐색하는 웹사이트입니다. 건물로 이동하면 각각의 콘텐츠를 만나볼 수 있습니다.",
          "컴포넌트별 책임을 나누고 키보드 탐색, 모바일 화면, 라이트·다크 모드를 함께 설계했습니다.",
        ],
      },
      {
        id: "reading-room",
        title: "Reading Room",
        category: "Personal project",
        date: "2026.09.24",
        description: "읽고 싶은 글과 짧은 생각을 한곳에 모으는 공간.",
        tags: ["Vue", "IndexedDB"],
        paragraphs: [
          "다시 읽고 싶은 글을 분류하고 개인적인 메모를 덧붙이는 작은 웹 애플리케이션입니다.",
          "검색과 카테고리로 기록을 빠르게 찾고 브라우저에 내용을 보관하는 흐름을 구성했습니다.",
        ],
      },
    ],
    issues: [
      {
        id: "browser-rendering",
        title: "3D 웹의 렌더링은 어디에서 일어날까?",
        category: "Web Graphics",
        date: "2026.10.05",
        description: "브라우저 렌더링과 정적 파일 전송을 나누어 생각하기.",
        tags: ["WebGL", "Performance"],
        paragraphs: [
          "3D 화면을 그리는 작업과 화면에 필요한 파일을 전달하는 작업은 서로 다릅니다. 브라우저는 전달받은 코드와 리소스를 이용해 장면을 그립니다.",
          "파일 다운로드 시간과 프레임 렌더링 시간을 따로 측정하면 어디를 개선해야 하는지 더 분명해집니다.",
        ],
      },
      {
        id: "http-cache",
        title: "캐시를 적용하기 전에 확인할 것들",
        category: "Architecture",
        date: "2026.09.29",
        description: "공개 콘텐츠와 개인화된 응답의 캐시 경계.",
        tags: ["HTTP", "CDN"],
        paragraphs: [
          "모든 사용자에게 같은 내용을 보여주는 리소스와 사용자마다 다른 응답을 먼저 구분합니다.",
          "캐시 정책을 설정할 때는 유효기간뿐 아니라 캐시 키와 갱신 방법도 함께 정리해야 합니다. 개인 정보가 포함된 응답은 공유 캐시에 저장되지 않도록 설계합니다.",
        ],
      },
    ],
  };
}

export function homeBlogPosts(
  posts: readonly BlogPost[],
  owner: BlogAuthor,
  viewerId?: number,
) {
  return posts
    .filter(
      (post) =>
        post.author?.id === owner.id &&
        post.status === "PUBLISHED" &&
        (post.visibility !== "PRIVATE" || owner.id === viewerId),
    )
    .sort(
      (a, b) =>
        Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id - a.id,
    );
}
