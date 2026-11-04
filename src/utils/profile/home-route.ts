const RESERVED = new Set(["admin", "assets", "auth", "blog", "healthz", "home", "login", "news", "onboarding", "portfolio", "write"]);
export function hasNicknamePath(value: unknown): value is string {
  return typeof value === "string" && /^[가-힣A-Za-z0-9_]{2,20}$/.test(value) && !RESERVED.has(value.toLowerCase());
}
export function homeRoute(user: { nickname?: string | null }, query: Record<string, string | undefined> = {}) {
  return hasNicknamePath(user.nickname)
    ? { name: "user-profile", params: { nickname: user.nickname }, query }
    : { name: "user-home", query };
}
