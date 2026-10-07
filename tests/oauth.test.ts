import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumeOAuthAttempt,
  googleLoginUrl,
  OAUTH_ATTEMPT_KEY,
  safeAuthReturn,
} from "@/utils/auth/oauth";
import { createAuthSession } from "@/store/auth";
import { mockOAuthFetch, startMockOAuthSession } from "@/services/mock-oauth";
import { prepareAvatar } from "@/utils/profile/avatar-upload";
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
describe("OAuth 인증과 온보딩", () => {
  it("로그인 복귀 주소만 저장하고 한 번 복원할 수 있다.", () => {
    const url = new URL(googleLoginUrl("/blog/writer/post"), location.origin);
    expect(url.pathname).toBe("/auth/callback");
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
    vi.stubEnv("VITE_AUTH_MOCK", "false");
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
    vi.stubEnv("VITE_AUTH_MOCK", "false");
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
  it("토큰 저장 없이 프로필을 완성하고 다음 로그인에서 온보딩을 건너뛸 수 있다.", async () => {
    const session = createAuthSession({ fetch: mockOAuthFetch });
    startMockOAuthSession();
    await session.completeOAuthLogin();
    expect(session.needsOnboarding.value).toBe(true);
    expect(sessionStorage.getItem("codeiary.oauth.mock.tokens")).toBeNull();
    expect(sessionStorage.getItem("codeiary.session")).toBeNull();
    expect(await session.checkNickname("Codeiary")).toEqual({
      available: false,
    });
    await expect(
      session.completeOnboarding("Codeiary", null),
    ).rejects.toMatchObject({ code: "NICKNAME_TAKEN" });
    expect(session.needsOnboarding.value).toBe(true);
    await session.completeOnboarding("새로운기록자", null);
    expect(session.user.value).toMatchObject({
      nickname: "새로운기록자",
      profileImageUrl: null,
      onboardingCompleted: true,
      role: "USER",
    });
    await session.logout();
    expect(sessionStorage.getItem("codeiary.oauth.mock.session")).toBeNull();
    startMockOAuthSession();
    await session.completeOAuthLogin();
    expect(session.needsOnboarding.value).toBe(false);
    expect(session.user.value?.nickname).toBe("새로운기록자");
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
