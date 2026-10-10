export const OAUTH_ATTEMPT_KEY = "codeiary.oauth.attempt";

export function safeAuthReturn(value: unknown) {
  if (typeof value !== "string") return "/";
  if (/^\/blog(?:\/[^/?#\\]+){0,2}(?:\?[^#\\]*)?(?:#[^\\]*)?$/.test(value))
    return value;
  if (/^\/write(?:\/[a-f0-9-]{36})?$/.test(value) || value === "/admin")
    return value;
  return "/";
}
export function googleLoginUrl(redirect: unknown) {
  const endpoint =
    import.meta.env.VITE_GOOGLE_AUTH_URL || "/oauth2/authorization/google";
  const url = new URL(endpoint, location.origin);
  if (
    url.protocol !== "https:" &&
    !(import.meta.env.DEV && url.origin === location.origin)
  )
    throw new Error("로그인 연결 주소를 확인해 주세요.");
  try {
    sessionStorage.setItem(
      OAUTH_ATTEMPT_KEY,
      JSON.stringify({ redirect: safeAuthReturn(redirect), createdAt: Date.now() }),
    );
  } catch {
    // Cookie authentication still works when optional return-address storage is blocked.
  }
  // Spring owns OAuth state, Google code exchange, and authentication cookies.
  return url.href;
}
export function consumeOAuthAttempt() {
  let saved: { redirect?: string; createdAt?: number } | null = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(OAUTH_ATTEMPT_KEY) ?? "null");
    sessionStorage.removeItem(OAUTH_ATTEMPT_KEY);
  } catch {
    /* The server validates OAuth; a missing return address falls back to home. */
  }
  if (
    !saved ||
    typeof saved.createdAt !== "number" ||
    !Number.isFinite(saved.createdAt) ||
    saved.createdAt > Date.now() ||
    Date.now() - saved.createdAt > 600000
  )
    return "/";
  return safeAuthReturn(saved.redirect);
}
