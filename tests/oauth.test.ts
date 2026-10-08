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
import { userFixture } from "./fixtures/auth";
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
  it("토큰 저장 없이 온보딩과 프로필 설정을 완료하고 다음 로그인에서 복원할 수 있다.", async () => {
    const fetchMock = vi.fn(mockOAuthFetch);
    const session = createAuthSession({ fetch: fetchMock });
    startMockOAuthSession();
    await session.completeOAuthLogin();
    expect(session.needsOnboarding.value).toBe(true);
    expect(session.user.value?.role).toBe("PENDING");
    expect(sessionStorage.getItem("codeiary.oauth.mock.tokens")).toBeNull();
    expect(sessionStorage.getItem("codeiary.session")).toBeNull();
    const profileInput = {
      nickname: "새로운기록자",
      profileImageUrl: "https://example.com/profile.png",
      githubUrl: "https://github.com/code-writer",
      contactEmail: "public@example.com",
    };
    await expect(session.updateProfile(profileInput)).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
    expect(session.user.value?.role).toBe("PENDING");
    expect(await session.checkNickname("Codeiary")).toEqual({
      available: false,
    });
    await expect(
      session.completeOnboarding("Codeiary"),
    ).rejects.toMatchObject({ code: "NICKNAME_TAKEN" });
    expect(session.needsOnboarding.value).toBe(true);
    await session.completeOnboarding("새로운기록자");
    const requests = fetchMock.mock.calls
      .filter(([url]) => String(url).endsWith("/users/me/onboarding"));
    const onboarding = requests[requests.length - 1]?.[1]?.body;
    expect(onboarding).toBeInstanceOf(FormData);
    expect(Array.from((onboarding as FormData).keys())).toEqual(["nickname"]);
    expect(session.user.value).toMatchObject({
      nickname: "새로운기록자",
      profileImageUrl: null,
      onboardingCompleted: true,
      role: "USER",
    });
    await session.updateProfile(profileInput);
    expect(await session.authorizedRequest("/users/me")).toMatchObject({
      ...profileInput,
      email: "preview@example.com",
      role: "USER",
      onboardingCompleted: true,
    });
    await session.logout();
    expect(sessionStorage.getItem("codeiary.oauth.mock.session")).toBeNull();
    startMockOAuthSession();
    await session.completeOAuthLogin();
    expect(session.needsOnboarding.value).toBe(false);
    expect(session.user.value?.nickname).toBe("새로운기록자");
  });
  it("선택 프로필 정보를 null로 삭제하고 기존 권한을 유지할 수 있다.", async () => {
    const profile = {
      ...userFixture("ADMIN"),
      nickname: "프로필주인",
      profileImageUrl: "https://example.com/profile.png",
      githubUrl: "https://github.com/code-writer",
      contactEmail: "public@example.com",
      onboardingCompleted: true,
    };
    localStorage.setItem("codeiary.oauth.mock.profile", JSON.stringify(profile));
    startMockOAuthSession();
    const session = createAuthSession({ fetch: mockOAuthFetch });
    await session.completeOAuthLogin();

    await session.updateProfile({
      nickname: profile.nickname,
      profileImageUrl: null,
      githubUrl: null,
      contactEmail: null,
    });

    expect(await session.authorizedRequest("/users/me")).toEqual({
      ...profile,
      profileImageUrl: null,
      githubUrl: null,
      contactEmail: null,
    });
  });
  it("중복 닉네임 수정은 409로 거절하고 기존 프로필을 유지할 수 있다.", async () => {
    const profile = {
      ...userFixture("USER"),
      nickname: "프로필주인",
      profileImageUrl: null,
      githubUrl: null,
      contactEmail: "public@example.com",
      onboardingCompleted: true,
    };
    localStorage.setItem("codeiary.oauth.mock.profile", JSON.stringify(profile));
    startMockOAuthSession();
    const session = createAuthSession({ fetch: mockOAuthFetch });
    await session.completeOAuthLogin();

    await expect(session.updateProfile({
      nickname: "CODEIARY",
      profileImageUrl: null,
      githubUrl: null,
      contactEmail: null,
    })).rejects.toMatchObject({ status: 409, code: "NICKNAME_TAKEN" });

    expect(session.user.value).toEqual(profile);
    expect(await session.authorizedRequest("/users/me")).toEqual(profile);
  });
  it("온보딩 후 사진을 업로드하고 저장할 때 프로필에 반영할 수 있다.", async () => {
    const session = createAuthSession({ fetch: mockOAuthFetch });
    const file = new File([new Uint8Array([255, 216, 255, 217])], "profile.jpg", { type: "image/jpeg" });
    startMockOAuthSession();
    await session.completeOAuthLogin();

    await expect(session.uploadProfileImage(file)).rejects.toMatchObject({ status: 403 });
    await session.completeOnboarding("사진기록자");
    const uploaded = await session.uploadProfileImage(file);

    expect(uploaded.profileImageUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(session.user.value?.profileImageUrl).toBeNull();
    await session.updateProfile({
      nickname: "사진기록자",
      profileImageUrl: uploaded.profileImageUrl,
      githubUrl: null,
      contactEmail: null,
    });
    expect(session.user.value?.profileImageUrl).toBe(uploaded.profileImageUrl);
    expect(session.user.value?.role).toBe("USER");
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
