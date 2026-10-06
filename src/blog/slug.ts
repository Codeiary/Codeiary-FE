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
