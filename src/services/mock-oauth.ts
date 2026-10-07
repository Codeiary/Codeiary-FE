import type { UserProfile } from "@/store/auth";
import { nicknameError } from "@/utils/auth/validation";

const PROFILE_KEY = "codeiary.oauth.mock.profile";
const SESSION_KEY = "codeiary.oauth.mock.session";
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
export function startMockOAuthSession() {
  if (!import.meta.env.DEV) throw new Error("개발 환경에서만 사용할 수 있어요.");
  sessionStorage.removeItem("codeiary.oauth.mock.tokens");
  sessionStorage.setItem(SESSION_KEY, "active");
}
function available(nickname: string) {
  return !usedNicknames.has(nickname.trim().toLocaleLowerCase());
}
// Dev-only session marker simulates cookie authentication without storing token values.
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
    const signedIn = sessionStorage.getItem(SESSION_KEY) === "active";
    const method = init?.method ?? "GET";
    if (init?.credentials !== "include")
      return json({ code: "UNAUTHORIZED" }, 401);
    if (url.pathname.endsWith("/auth/logout") && method === "POST") {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem("codeiary.oauth.mock.tokens");
      return new Response(null, { status: 204 });
    }
    if (!signedIn) return json({ code: "UNAUTHORIZED" }, 401);
    if (url.pathname.endsWith("/auth/reissue") && method === "POST")
      return new Response(null, { status: 204 });
    if (url.pathname.endsWith("/users/me") && method === "GET")
      return json(profile());
    if (url.pathname.endsWith("/admin/me") && method === "GET")
      return profile().role === "ADMIN"
        ? json(profile())
        : json({ code: "FORBIDDEN" }, 403);
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
