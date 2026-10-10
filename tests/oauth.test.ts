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
  it("로그인 복귀 주소만 저장하고 한 번 복원할 수 있다.", () => {
    const url = new URL(googleLoginUrl("/blog/writer/post"), location.origin);
    expect(url.pathname).toBe("/oauth2/authorization/google");
    expect(url.searchParams.has("code")).toBe(false);
    expect(url.searchParams.has("state")).toBe(false);
    expect(JSON.parse(sessionStorage.getItem(OAUTH_ATTEMPT_KEY)!)).toEqual({
      redirect: "/blog/writer/post",
      createdAt: expect.any(Number),
    });
    expect(consumeOAuthAttempt()).toBe("/blog/writer/post");
    expect(consumeOAuthAttempt()).toBe("/");
  });
  it("만료된 복귀 정보나 외부 주소 대신 홈으로 복귀할 수 있다.", () => {
    sessionStorage.setItem(
      OAUTH_ATTEMPT_KEY,
      JSON.stringify({ createdAt: Date.now() - 600001, redirect: "/" }),
    );
    expect(consumeOAuthAttempt()).toBe("/");
    expect(safeAuthReturn("//example.com")).toBe("/");
  });
  it("앱 교환 코드 없이 백엔드 Google 로그인으로 이동할 수 있다.", async () => {
    vi.stubEnv("VITE_GOOGLE_AUTH_URL", "");
    vi.resetModules();
    try {
      const { googleLoginUrl: realLoginUrl } = await import("@/utils/auth/oauth");
      const url = new URL(realLoginUrl("/blog"), location.origin);
      expect(url.pathname).toBe("/oauth2/authorization/google");
      expect(url.search).toBe("");
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
  it("저장소가 차단되어도 실제 Google 로그인을 시작하고 홈으로 복귀할 수 있다.", async () => {
    vi.stubEnv("VITE_GOOGLE_AUTH_URL", "");
    vi.resetModules();
    const setItem = vi.spyOn(sessionStorage, "setItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    const getItem = vi.spyOn(sessionStorage, "getItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    try {
      const oauth = await import("@/utils/auth/oauth");
      expect(new URL(oauth.googleLoginUrl("/blog"), location.origin).pathname).toBe(
        "/oauth2/authorization/google",
      );
      expect(oauth.consumeOAuthAttempt()).toBe("/");
    } finally {
      setItem.mockRestore();
      getItem.mockRestore();
      vi.unstubAllEnvs();
      vi.resetModules();
    }
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
