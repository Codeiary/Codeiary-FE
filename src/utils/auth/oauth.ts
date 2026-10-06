export const OAUTH_ATTEMPT_KEY = "codeiary.oauth.attempt";
export const oauthMockEnabled =
  import.meta.env.DEV && import.meta.env.VITE_AUTH_MOCK !== "false";

export function safeAuthReturn(value: unknown) {
  if (typeof value !== "string") return "/";
  if (/^\/blog(?:\/[^/?#\\]+){0,2}(?:\?[^#\\]*)?(?:#[^\\]*)?$/.test(value))
    return value;
  if (/^\/write(?:\/[a-f0-9-]{36})?$/.test(value) || value === "/admin")
    return value;
  return "/";
}
export function googleLoginUrl(redirect: unknown) {
  const state = crypto.randomUUID();
  const attempt = {
    state,
    redirect: safeAuthReturn(redirect),
    createdAt: Date.now(),
  };
  const endpoint = import.meta.env.VITE_GOOGLE_AUTH_URL;
  if (!oauthMockEnabled && !endpoint)
    throw new Error(
      "Google 로그인 연결을 준비 중이에요. 잠시 후 다시 방문해 주세요.",
    );
  try {
    sessionStorage.setItem(OAUTH_ATTEMPT_KEY, JSON.stringify(attempt));
  } catch {
    throw new Error("로그인을 위해 브라우저의 사이트 저장소를 허용해 주세요.");
  }
  if (oauthMockEnabled)
    return `/auth/callback?code=preview-${crypto.randomUUID()}&state=${state}`;
  const url = new URL(endpoint, location.origin);
  if (
    url.protocol !== "https:" &&
    !(import.meta.env.DEV && url.origin === location.origin)
  )
    throw new Error("로그인 연결 주소를 확인해 주세요.");
  // The backend owns Google authorization and returns a short-lived app exchange code.
  url.searchParams.set("client_state", state);
  url.searchParams.set(
    "redirect_uri",
    new URL("/auth/callback", location.origin).href,
  );
  return url.href;
}
export function consumeOAuthAttempt(state: unknown) {
  let saved: { state?: string; redirect?: string; createdAt?: number } | null =
    null;
  try {
    saved = JSON.parse(sessionStorage.getItem(OAUTH_ATTEMPT_KEY) ?? "null");
    sessionStorage.removeItem(OAUTH_ATTEMPT_KEY);
  } catch {
    /* Treat blocked or invalid storage as an expired attempt. */
  }
  if (
    !saved ||
    typeof state !== "string" ||
    saved.state !== state ||
    !saved.createdAt ||
    Date.now() - saved.createdAt > 600000
  )
    throw new Error(
      "로그인 요청이 만료되었어요. Google로 다시 로그인해 주세요.",
    );
  return safeAuthReturn(saved.redirect);
}
