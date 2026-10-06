import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumeOAuthAttempt,
  googleLoginUrl,
  OAUTH_ATTEMPT_KEY,
  safeAuthReturn,
} from "@/utils/auth/oauth";
import { createAuthSession } from "@/store/auth";
import { mockOAuthFetch } from "@/services/mock-oauth";
import { storageFixture } from "./fixtures/auth";
import { prepareAvatar } from "@/utils/profile/avatar-upload";
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
describe("OAuth 인증과 온보딩", () => {
  it("한 번만 사용할 수 있는 로그인 상태를 검증하고 요청한 글 주소를 복원할 수 있다.", () => {
    const url = new URL(googleLoginUrl("/blog/writer/post"), location.origin);
    expect(url.pathname).toBe("/auth/callback");
    expect(consumeOAuthAttempt(url.searchParams.get("state"))).toBe(
      "/blog/writer/post",
    );
    expect(() => consumeOAuthAttempt(url.searchParams.get("state"))).toThrow(
      "만료",
    );
  });
  it("상태가 다르거나 만료된 로그인 응답을 거절할 수 있다.", () => {
    googleLoginUrl("/");
    expect(() => consumeOAuthAttempt("different")).toThrow("만료");
    sessionStorage.setItem(
      OAUTH_ATTEMPT_KEY,
      JSON.stringify({
        state: "old",
        createdAt: Date.now() - 600001,
        redirect: "/",
      }),
    );
    expect(() => consumeOAuthAttempt("old")).toThrow("만료");
    expect(safeAuthReturn("//example.com")).toBe("/");
  });
  it("신규 프로필을 완성하고 JWT 세션 구조를 유지한 채 다음 로그인에서 온보딩을 건너뛸 수 있다.", async () => {
    const session = createAuthSession({
      fetch: mockOAuthFetch,
      storage: () => storageFixture(),
    });
    await session.exchangeOAuthCode("preview-new", "state");
    expect(session.needsOnboarding.value).toBe(true);
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
    await session.exchangeOAuthCode("preview-returning", "state2");
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
