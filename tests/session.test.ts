import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError, createAuthSession, SESSION_KEY } from "@/store/auth";
import {
  oauthCode,
  deferred,
  jsonResponse,
  storageFixture,
  tokenFixture,
  userFixture,
} from "./fixtures/auth";

describe("JWT 로그인 세션", () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  let storage: ReturnType<typeof storageFixture>;
  let session: ReturnType<typeof createAuthSession>;
  let now: number;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    storage = storageFixture();
    now = 1_000_000;
    session = createAuthSession({
      fetch: fetchMock,
      storage: () => storage,
      now: () => now,
    });
  });

  async function login() {
    fetchMock.mockResolvedValueOnce(jsonResponse(tokenFixture()));
    await session.exchangeOAuthCode(oauthCode.code, oauthCode.state);
  }

  it("OAuth 교환 코드로 로그인하고 갱신 토큰만 저장할 수 있다.", async () => {
    await login();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/oauth2/exchange",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(oauthCode),
      }),
    );
    expect(session.user.value).toEqual(userFixture());
    const saved = storage.getItem(SESSION_KEY)!;
    expect(JSON.parse(saved)).toEqual({
      refreshToken: "refresh-first",
      refreshExpiresAt: now + 604800000,
    });
    expect(saved).not.toContain("access-first");
    expect(saved).not.toContain(oauthCode.code);
  });

  it("새로고침 후 회전된 갱신 토큰으로 세션을 복원할 수 있다.", async () => {
    await login();
    const reloaded = createAuthSession({
      fetch: fetchMock,
      storage: () => storage,
      now: () => now,
    });
    fetchMock.mockResolvedValueOnce(jsonResponse(tokenFixture("rotated")));
    await Promise.all([reloaded.restore(), reloaded.restore()]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![0]).toBe("/api/auth/refresh");
    expect(reloaded.user.value?.email).toBe(userFixture().email);
    expect(storage.getItem(SESSION_KEY)).toContain("refresh-rotated");
  });

  it("만료 시 동시 요청의 토큰을 한 번만 갱신할 수 있다.", async () => {
    await login();
    now += 1800000;
    const pending = deferred<Response>();
    fetchMock
      .mockReturnValueOnce(pending.promise)
      .mockImplementation(async () => jsonResponse(userFixture()));
    const requests = [session.verifyAdmin(), session.verifyAdmin()];
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    pending.resolve(jsonResponse(tokenFixture("rotated")));
    await Promise.all(requests);
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/auth/refresh"),
    ).toHaveLength(1);
    expect(
      fetchMock.mock.calls
        .slice(2)
        .every(
          ([, init]) =>
            (init?.headers as Record<string, string>).Authorization ===
            "Bearer access-rotated",
        ),
    ).toBe(true);
  });

  it("늦게 도착한 401 응답도 이미 갱신된 토큰으로 재시도할 수 있다.", async () => {
    await login();
    const late = deferred<Response>();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ code: "UNAUTHORIZED" }, 401))
      .mockReturnValueOnce(late.promise)
      .mockResolvedValueOnce(jsonResponse(tokenFixture("rotated")))
      .mockImplementation(async () => jsonResponse(userFixture()));
    const first = session.verifyAdmin();
    const second = session.verifyAdmin();
    await first;
    late.resolve(jsonResponse({ code: "UNAUTHORIZED" }, 401));
    await second;
    expect(
      fetchMock.mock.calls.filter(([url]) => url === "/api/auth/refresh"),
    ).toHaveLength(1);
  });

  it("거절된 갱신 토큰의 세션을 제거할 수 있다.", async () => {
    await login();
    now += 1800000;
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ code: "INVALID_REFRESH_TOKEN" }, 401),
    );
    await expect(session.verifyAdmin()).rejects.toMatchObject({ status: 401 });
    expect(session.user.value).toBeNull();
    expect(storage.getItem(SESSION_KEY)).toBeNull();
    expect(session.notice.value).toContain("만료");
  });

  it("갱신 후에도 거절된 액세스 토큰을 제거할 수 있다.", async () => {
    await login();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse(tokenFixture("rotated")))
      .mockResolvedValueOnce(jsonResponse({}, 401));
    await expect(session.verifyAdmin()).rejects.toMatchObject({ status: 401 });
    expect(session.user.value).toBeNull();
    expect(storage.getItem(SESSION_KEY)).toBeNull();
  });

  it("네트워크 오류 후 세션을 유지하고 갱신을 재시도할 수 있다.", async () => {
    await login();
    now += 1800000;
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await expect(session.verifyAdmin()).rejects.toBeInstanceOf(AuthError);
    expect(session.user.value).not.toBeNull();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(tokenFixture("retry")))
      .mockResolvedValueOnce(jsonResponse(userFixture()));
    await session.verifyAdmin();
    expect(storage.getItem(SESSION_KEY)).toContain("refresh-retry");
  });

  it("서버 토큰 폐기 후 로그아웃할 수 있다.", async () => {
    await login();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await Promise.all([session.logout(), session.logout()]);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/auth/logout",
      expect.objectContaining({
        body: JSON.stringify({ refreshToken: "refresh-first" }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(session.user.value).toBeNull();
    expect(storage.getItem(SESSION_KEY)).toBeNull();
  });

  it("실패한 로그아웃을 다시 요청할 수 있다.", async () => {
    await login();
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await expect(session.logout()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    });
    expect(session.user.value).not.toBeNull();
    expect(session.signingOut.value).toBe(false);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await session.logout();
    expect(session.user.value).toBeNull();
  });

  it("진행 중인 토큰 갱신이 끝난 뒤 최신 토큰으로 로그아웃할 수 있다.", async () => {
    await login();
    now += 1800000;
    const pending = deferred<Response>();
    fetchMock
      .mockReturnValueOnce(pending.promise)
      .mockImplementation(async (url) =>
        url === "/api/auth/logout"
          ? new Response(null, { status: 204 })
          : jsonResponse(userFixture()),
      );
    const refresh = session.revalidate();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const logout = session.logout();
    pending.resolve(jsonResponse(tokenFixture("rotated")));
    await Promise.all([refresh, logout]);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/auth/logout",
      expect.objectContaining({
        body: JSON.stringify({ refreshToken: "refresh-rotated" }),
      }),
    );
    expect(session.user.value).toBeNull();
  });

  it("서버의 관리자 권한 거절을 전달할 수 있다.", async () => {
    await login();
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: "FORBIDDEN" }, 403));
    await expect(session.verifyAdmin()).rejects.toMatchObject({ status: 403 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("늦게 도착한 관리자 응답이 로그아웃 상태를 되돌리지 않게 할 수 있다.", async () => {
    await login();
    const pending = deferred<Response>();
    fetchMock
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const check = session.verifyAdmin();
    const result = expect(check).rejects.toMatchObject({
      code: "SESSION_CHANGED",
    });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await session.logout();
    pending.resolve(jsonResponse(userFixture()));
    await result;
    expect(session.user.value).toBeNull();
    expect(storage.getItem(SESSION_KEY)).toBeNull();
  });

  it("만료된 브라우저 세션을 서버 요청 없이 제거할 수 있다.", async () => {
    storage.setItem(
      SESSION_KEY,
      JSON.stringify({ refreshToken: "expired", refreshExpiresAt: now - 1 }),
    );
    expect(await session.restore()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(storage.getItem(SESSION_KEY)).toBeNull();
  });

  it("브라우저 저장소가 차단되어도 로그인할 수 있다.", async () => {
    session = createAuthSession({
      fetch: fetchMock,
      storage: () => {
        throw new Error("blocked");
      },
    });
    await login();
    expect(session.user.value).toEqual(userFixture());
  });

  it("만료된 OAuth 코드로 인증 상태가 생성되는 것을 방지할 수 있다.", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ code: "INVALID_OAUTH_CODE" }, 401),
    );
    await expect(
      session.exchangeOAuthCode(oauthCode.code, oauthCode.state),
    ).rejects.toMatchObject({
      code: "INVALID_OAUTH_CODE",
      message: "Google 로그인 요청이 만료되었어요. 다시 로그인해 주세요.",
    });
    expect(session.user.value).toBeNull();
    expect(storage.getItem(SESSION_KEY)).toBeNull();
  });
});
