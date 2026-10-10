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
  profileImageUrl?: string | null;
  projects: HomeEntry[];
  issues: HomeEntry[];
}

export function createHomeProfile(user: UserProfile | null): HomeProfile {
  return {
    owner: user
      ? {
          id: user.id,
          name: user.nickname?.trim() || user.name,
          nickname: user.nickname,
          profileImageUrl: user.profileImageUrl,
        }
      : { id: "demo-guest", name: "내 집" },
    email: user?.contactEmail ?? "",
    github: user?.githubUrl ?? "",
    profileImageUrl: user?.profileImageUrl ?? null,
    projects: [],
    issues: [],
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
