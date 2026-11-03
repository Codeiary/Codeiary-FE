export function postSlug(title: string) {
  return (
    title
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase("ko-KR")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "post"
  );
}

export function authorSlug(name: string) {
  return (
    name
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase("ko-KR")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "blog"
  );
}

export function postPath(authorName: string, title: string, id: number, slug?: string) {
  return `/blog/${encodeURIComponent(authorSlug(authorName))}/${encodeURIComponent(slug || postSlug(title))}/${id}`;
}
