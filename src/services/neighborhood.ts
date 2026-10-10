import { displayName } from "@/utils/profile/display-name";
import type { UserProfile } from "@/store/auth";
import type { BlogPost } from "@/utils/blog/posts";
import { houseLevelForPostCount } from "@/utils/city/residence-tiers";
import { createAuthApi } from "@/services/auth-api";
import {
  HOMES_PER_BLOCK,
  orderedResidences,
  type Residence,
} from "@/utils/city/residences";

interface ApiNeighborhoodResident {
  id: number;
  nickname: string;
  profileImageUrl: string | null;
  githubUrl: string | null;
  contactEmail: string | null;
  postCount: number;
}

interface ApiNeighborhoodPage {
  content: ApiNeighborhoodResident[];
  totalPages: number;
}

const api = createAuthApi();

export async function fetchNeighborhoodResidents(): Promise<Residence[]> {
  const firstPage = await api.request<ApiNeighborhoodPage>(
    "/users/neighborhood?page=0&size=100",
  );
  const pages = await Promise.all(
    Array.from({ length: Math.max(0, firstPage.totalPages - 1) }, (_, index) =>
      api.request<ApiNeighborhoodPage>(`/users/neighborhood?page=${index + 1}&size=100`),
    ),
  );

  return [firstPage, ...pages].flatMap((page) => page.content).map((resident) => ({
    id: resident.id,
    name: resident.nickname,
    nickname: resident.nickname,
    profileImageUrl: resident.profileImageUrl,
    role: "USER",
    postCount: resident.postCount,
    level: houseLevelForPostCount(resident.postCount),
    activityPoints: null,
    activity: resident.postCount,
    email: resident.contactEmail ?? undefined,
    github: resident.githubUrl ?? undefined,
  }));
}

export function residenceDirectory(
  user: UserProfile | null,
  posts: readonly BlogPost[],
  ownPostCount?: number,
) {
  const residents = new Map<string | number, Residence>();

  for (const post of posts) {
    const author = post.author;
    if (!author) continue;
    const id = author.id;
    const current = residents.get(id);
    if (!current) {
      residents.set(id, {
        ...author,
        role: "USER",
        postCount: 0,
        level: 0,
        activityPoints: null,
        activity: 0,
      });
    }
  }

  for (const resident of residents.values()) {
    const isCurrentUser = user?.id === resident.id;
    const postCount = isCurrentUser && ownPostCount !== undefined
      ? ownPostCount
      : posts.filter((post) =>
          post.author?.id === resident.id &&
          post.status === "PUBLISHED" &&
          (isCurrentUser || post.visibility !== "PRIVATE"),
        ).length;
    resident.postCount = postCount;
    resident.level = houseLevelForPostCount(postCount);
    resident.activity = postCount;
  }

  if (user && !residents.has(user.id)) {
    residents.set(user.id, {
      id: user.id,
      name: displayName(user),
      nickname: user.nickname,
      profileImageUrl: user.profileImageUrl,
      role: user.role,
      postCount: ownPostCount ?? 0,
      level: houseLevelForPostCount(ownPostCount ?? 0),
      activityPoints: null,
      activity: ownPostCount ?? 0,
      email: user.contactEmail ?? undefined,
      github: user.githubUrl ?? undefined,
    });
  } else if (user) {
    const own = residents.get(user.id)!;
    Object.assign(own, {
      name: displayName(user),
      nickname: user.nickname,
      profileImageUrl: user.profileImageUrl,
      role: user.role,
      email: user.contactEmail ?? undefined,
      github: user.githubUrl ?? undefined,
    });
  }

  return [...residents.values()];
}

export interface NeighborhoodBlock {
  page: number;
  residents: Residence[];
  total: number;
  hasNext: boolean;
}

export async function fetchNeighborhoodBlock(
  directory: readonly Residence[],
  page: number,
): Promise<NeighborhoodBlock> {
  const residents = orderedResidences(directory);
  const start = Math.max(0, page) * HOMES_PER_BLOCK;
  return {
    page,
    residents: residents.slice(start, start + HOMES_PER_BLOCK),
    total: residents.length,
    hasNext: start + HOMES_PER_BLOCK < residents.length,
  };
}

export function searchResidences(
  directory: readonly Residence[],
  query: string,
) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  return directory.filter((resident) =>
    displayName(resident).toLocaleLowerCase().includes(normalized),
  );
}
