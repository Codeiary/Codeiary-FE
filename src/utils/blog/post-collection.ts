import type { BlogPost } from "@/utils/blog/posts";

export interface PostFilters {
  search: string;
  category: string;
  tag: string;
  sort: "latest" | "views";
}

export function categoryCounts(posts: readonly BlogPost[]) {
  const counts = new Map<string, number>();
  for (const post of posts) {
    if (post.category)
      counts.set(post.category, (counts.get(post.category) ?? 0) + 1);
  }
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b, "ko"))
    .map(([name, count]) => ({ name, count }));
}

export function filterPosts(posts: readonly BlogPost[], filters: PostFilters) {
  const query = filters.search.trim().toLocaleLowerCase("ko-KR");
  const tag = filters.tag.toLocaleLowerCase("ko-KR");
  return posts
    .filter((post) => {
      const text = `${post.title} ${post.description} ${post.content ?? ""} ${post.tags.join(" ")}`;
      return (
        (!filters.category || post.category === filters.category) &&
        (!tag ||
          post.tags.some(
            (value) => value.toLocaleLowerCase("ko-KR") === tag,
          )) &&
        text.toLocaleLowerCase("ko-KR").includes(query)
      );
    })
    .sort((left, right) => {
      if (filters.sort === "views" && left.viewCount !== right.viewCount)
        return right.viewCount - left.viewCount;
      return (
        Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
        right.id - left.id
      );
    });
}
