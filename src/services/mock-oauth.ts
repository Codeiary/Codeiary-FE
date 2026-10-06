import type { UserProfile } from "@/store/auth";
import { nicknameError } from "@/utils/auth/validation";

const PROFILE_KEY = "codeiary.oauth.mock.profile";
const TOKEN_KEY = "codeiary.oauth.mock.tokens";
const usedNicknames = new Set([
  "codeiary",
  "관리자",
  "커밋여행자",
  "프론트노트",
]);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
function profile(): UserProfile {
  const saved = localStorage.getItem(PROFILE_KEY);
  return saved
    ? JSON.parse(saved)
    : {
        id: 900001,
        email: "preview@example.com",
        name: "새로운 이웃",
        nickname: null,
        profileImageUrl: null,
        role: "USER",
        onboardingCompleted: false,
      };
}
function tokens() {
  const pair = {
    accessToken: `mock-access-${crypto.randomUUID()}`,
    refreshToken: `mock-refresh-${crypto.randomUUID()}`,
  };
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(pair));
  return {
    ...pair,
    tokenType: "Bearer",
    expiresIn: 1800,
    refreshExpiresIn: 604800,
    user: profile(),
  };
}
function available(nickname: string) {
  return !usedNicknames.has(nickname.trim().toLocaleLowerCase());
}
// Dev-only adapter. These opaque fixtures are never accepted by a real API.
export const mockOAuthFetch: typeof fetch = async (input, init) => {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
    location.origin,
  );
  try {
    if (url.pathname.endsWith("/auth/oauth2/exchange")) {
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (!String(body.code).startsWith("preview-") || !body.state)
        return json({ code: "INVALID_OAUTH_CODE" }, 401);
      return json(tokens());
    }
    const saved = JSON.parse(sessionStorage.getItem(TOKEN_KEY) ?? "null");
    if (
      url.pathname.endsWith("/auth/refresh") ||
      url.pathname.endsWith("/auth/logout")
    ) {
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (!saved || body.refreshToken !== saved.refreshToken)
        return json({ code: "INVALID_REFRESH_TOKEN" }, 401);
      if (url.pathname.endsWith("/auth/logout")) {
        sessionStorage.removeItem(TOKEN_KEY);
        return new Response(null, { status: 204 });
      }
      return json(tokens());
    }
    if (
      !saved ||
      new Headers(init?.headers).get("Authorization") !==
        `Bearer ${saved.accessToken}`
    )
      return json({ code: "UNAUTHORIZED" }, 401);
    if (url.pathname.endsWith("/users/nickname-availability")) {
      const nickname = url.searchParams.get("nickname") ?? "";
      if (nicknameError(nickname))
        return json({ code: "INVALID_NICKNAME" }, 400);
      return json({ available: available(nickname) });
    }
    if (
      url.pathname.endsWith("/users/me/onboarding") &&
      init?.body instanceof FormData
    ) {
      const nickname = String(init.body.get("nickname") ?? "").trim();
      if (nicknameError(nickname))
        return json({ code: "INVALID_NICKNAME" }, 400);
      if (!available(nickname)) return json({ code: "NICKNAME_TAKEN" }, 409);
      const photo = init.body.get("profileImage");
      let profileImageUrl: string | null = null;
      if (photo instanceof Blob && photo.size) {
        profileImageUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(photo);
        });
      }
      const updated = {
        ...profile(),
        nickname,
        profileImageUrl,
        onboardingCompleted: true,
      };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
      return json(updated);
    }
    return json({ code: "FORBIDDEN" }, 403);
  } catch {
    return json({ code: "MOCK_STORAGE_UNAVAILABLE" }, 503);
  }
};
