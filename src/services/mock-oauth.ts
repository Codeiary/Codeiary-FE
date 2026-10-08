import type { UserProfile } from "@/store/auth";
import { nicknameError } from "@/utils/auth/validation";

const PROFILE_KEY = "codeiary.oauth.mock.profile";
const SESSION_KEY = "codeiary.oauth.mock.session";
const uploadOrigin = "https://uploads.codeiary.invalid";
const imageOrigin = "https://images.codeiary.invalid";
const uploads = new Map<string, { contentType: string; contentLength: number; imageUrl: string; expiresAt: number }>();
const uploadedImages = new Map<string, string>();
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
        role: "PENDING",
        onboardingCompleted: false,
      };
}
export function startMockOAuthSession() {
  if (!import.meta.env.DEV) throw new Error("개발 환경에서만 사용할 수 있어요.");
  sessionStorage.removeItem("codeiary.oauth.mock.tokens");
  sessionStorage.setItem(SESSION_KEY, "active");
}
function available(nickname: string) {
  const normalized = nickname.trim().toLowerCase();
  return normalized === profile().nickname?.toLowerCase() || !usedNicknames.has(normalized);
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
    if (url.origin === uploadOrigin) {
      const upload = uploads.get(url.pathname);
      const headers = new Headers(init?.headers);
      if (method !== "PUT" || init?.credentials !== "omit" || headers.has("Authorization") || headers.has("Cookie")
          || !upload || upload.expiresAt <= Date.now())
        return json({ code: "UPLOAD_FORBIDDEN" }, 403);
      if (uploadedImages.has(upload.imageUrl))
        return json({ code: "PRECONDITION_FAILED" }, 412);
      const file = init?.body;
      if (!(file instanceof File) || file.type !== upload.contentType || file.size !== upload.contentLength
          || headers.get("Content-Type") !== upload.contentType)
        return json({ code: "INVALID_IMAGE" }, 400);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      uploadedImages.set(upload.imageUrl, dataUrl);
      return new Response(null, { status: 200 });
    }
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
      method === "POST" &&
      init?.body instanceof FormData
    ) {
      const nickname = String(init.body.get("nickname") ?? "").trim();
      if (nicknameError(nickname))
        return json({ code: "INVALID_NICKNAME" }, 400);
      if (!available(nickname)) return json({ code: "NICKNAME_TAKEN" }, 409);
      const updated = {
        ...profile(),
        nickname,
        onboardingCompleted: true,
        role: profile().role === "PENDING" ? "USER" : profile().role,
      };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
      return json(updated);
    }
    if (url.pathname.endsWith("/images/presigned-url") && method === "POST") {
      if (profile().role === "PENDING") return json({ code: "FORBIDDEN" }, 403);
      let input;
      try {
        input = JSON.parse(String(init?.body));
      } catch {
        return json({ code: "INVALID_PARAMETER" }, 400);
      }
      if (!input || !["image/jpeg", "image/png"].includes(input.contentType)
          || !Number.isSafeInteger(input.contentLength) || input.contentLength <= 0)
        return json({ code: "INVALID_IMAGE" }, 400);
      if (input.contentLength > 10 * 1024 * 1024) return json({ code: "PAYLOAD_TOO_LARGE" }, 413);
      const path = `/${crypto.randomUUID()}`;
      const imageUrl = `${imageOrigin}${path}`;
      const expiresAt = Date.now() + 300_000;
      uploads.set(path, { contentType: input.contentType, contentLength: input.contentLength, imageUrl, expiresAt });
      return json({
        uploadUrl: `${uploadOrigin}${path}`,
        imageUrl,
        headers: {
          "content-type": input.contentType,
          "cache-control": "public,max-age=31536000,immutable",
          "x-amz-server-side-encryption": "AES256",
          "if-none-match": "*",
        },
        expiresAt: new Date(expiresAt).toISOString(),
      });
    }
    if (url.pathname.endsWith("/users/me/profile") && method === "PUT") {
      const current = profile();
      if (current.role === "PENDING") return json({ code: "FORBIDDEN" }, 403);
      let input;
      try {
        input = JSON.parse(String(init?.body));
      } catch {
        return json({ code: "INVALID_PARAMETER" }, 400);
      }
      if (!input || typeof input.nickname !== "string" || nicknameError(input.nickname))
        return json({ code: "INVALID_NICKNAME" }, 400);
      if (!available(input.nickname)) return json({ code: "NICKNAME_TAKEN" }, 409);
      const optional = (value: unknown, max: number) =>
        value == null || (typeof value === "string" && value.length <= max);
      const mockImage = typeof input.profileImageUrl === "string"
        && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(input.profileImageUrl);
      const imageUrlLimit = mockImage ? 1_400_000 : 2048;
      if (!optional(input.profileImageUrl, imageUrlLimit) || !optional(input.githubUrl, 255)
          || !optional(input.contactEmail, 254))
        return json({ code: "INVALID_PARAMETER" }, 400);
      const profileImageUrl = input.profileImageUrl?.trim() || null;
      const githubUrl = input.githubUrl?.trim() || null;
      const contactEmail = input.contactEmail?.trim() || null;
      if ((profileImageUrl && !mockImage && !/^https:\/\/[^\s/]+(?:\/[^\s]*)?$/.test(profileImageUrl))
          || (githubUrl && !/^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\/?$/.test(githubUrl))
          || (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)))
        return json({ code: "INVALID_PARAMETER" }, 400);
      const updated: UserProfile = {
        ...current,
        nickname: input.nickname.trim(),
        profileImageUrl: uploadedImages.get(profileImageUrl) ?? profileImageUrl,
        githubUrl,
        contactEmail,
      };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(updated));
      return json(updated);
    }
    return json({ code: "FORBIDDEN" }, 403);
  } catch {
    return json({ code: "MOCK_STORAGE_UNAVAILABLE" }, 503);
  }
};
