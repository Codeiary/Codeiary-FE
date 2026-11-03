import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumeOAuthAttempt,
  googleLoginUrl,
  OAUTH_ATTEMPT_KEY,
  safeAuthReturn,
} from "@/utils/auth/oauth";
import { prepareAvatar } from "@/utils/profile/avatar-upload";
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
describe("OAuth 인증과 온보딩", () => {
  it("운영 API 도메인에서 Google 로그인을 시작하고 프론트 복귀 정보를 보존한다.", () => {
    vi.stubEnv("VITE_GOOGLE_AUTH_URL", "https://api.codeiary.com/oauth2/authorization/google");
    try {
      expect(googleLoginUrl("/blog")).toBe("https://api.codeiary.com/oauth2/authorization/google");
      expect(consumeOAuthAttempt()).toBe("/blog");
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("만료된 복귀 정보나 외부 주소 대신 홈으로 복귀할 수 있다.", () => {
    sessionStorage.setItem(
      OAUTH_ATTEMPT_KEY,
      JSON.stringify({ createdAt: Date.now() - 600001, redirect: "/" }),
    );
    expect(consumeOAuthAttempt()).toBe("/");
    expect(safeAuthReturn("//example.com")).toBe("/");
  });
  it("큰 파일과 사진이 아닌 파일을 변환 전에 거절할 수 있다.", async () => {
    await expect(
      prepareAvatar(
        new File(["<svg/>"], "image.svg", { type: "image/svg+xml" }),
      ),
    ).rejects.toThrow("사진 파일");
    const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    vi.spyOn(file, "size", "get").mockReturnValue(11 * 1024 * 1024);
    await expect(prepareAvatar(file)).rejects.toThrow("10MB");
  });
});
