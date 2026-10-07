import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError, createAuthSession } from "@/store/auth";
import { deferred, jsonResponse, storageFixture, userFixture } from "./fixtures/auth";

const unauthorized = () => jsonResponse({ code: "UNAUTHORIZED" }, 401);
const noContent = () => new Response(null, { status: 204 });

describe("HttpOnly 쿠키 로그인 세션", () => {
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  let storage: ReturnType<typeof storageFixture>;
  let session: ReturnType<typeof createAuthSession>;

  beforeEach(() => {
    // Exercise the fallback for browsers without Web Locks unless explicitly tested.
    vi.stubGlobal("navigator", { locks: undefined });
    fetchMock = vi.fn<typeof fetch>();
    storage = storageFixture();
    session = createAuthSession({ fetch: fetchMock, storage: () => storage });
  });

  afterEach(() => vi.unstubAllGlobals());

  async function login() {
    fetchMock.mockResolvedValueOnce(jsonResponse(userFixture()));
    await session.completeOAuthLogin();
  }

  function requestsTo(path: string) {
    return fetchMock.mock.calls.filter(([url]) => url === `/api${path}`);
  }

  function expectCookieRequests() {
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.credentials).toBe("include");
      expect(new Headers(init?.headers).has("Authorization")).toBe(false);
    }
  }

  it("OAuth 완료 후 사용자를 조회하고 저장 토큰을 삭제할 수 있다.", async () => {
    storage.setItem("codeiary.session", JSON.stringify({ refreshToken: "legacy" }));
    storage.setItem("codeiary.oauth.mock.tokens", "legacy-mock-tokens");
    const save = vi.spyOn(storage, "setItem");

    await login();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/users/me");
    expect(fetchMock.mock.calls[0]![1]?.body).toBeUndefined();
    expect(session.user.value).toEqual(userFixture());
    expect(storage.getItem("codeiary.session")).toBeNull();
    expect(storage.getItem("codeiary.oauth.mock.tokens")).toBeNull();
    expect(save).not.toHaveBeenCalled();
    expectCookieRequests();
  });

  it("쿠키로 세션을 한 번만 복원할 수 있다.", async () => {
    const pending = deferred<Response>();
    fetchMock.mockReturnValueOnce(pending.promise);
    const first = session.restore();
    const second = session.restore();
    expect(first).toBe(second);
    pending.resolve(jsonResponse(userFixture()));

    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/users/me");
    expect(session.user.value).toEqual(userFixture());
    expectCookieRequests();
  });

  it("복원 중 401이면 본문 없이 재발급하고 사용자를 다시 조회할 수 있다.", async () => {
    const save = vi.spyOn(storage, "setItem");
    fetchMock
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(noContent())
      .mockResolvedValueOnce(jsonResponse(userFixture()));

    expect(await session.restore()).toBe(true);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/users/me", "/api/auth/reissue", "/api/users/me",
    ]);
    const reissue = requestsTo("/auth/reissue")[0]![1];
    expect(reissue?.method).toBe("POST");
    expect(reissue?.body).toBeUndefined();
    expect(new Headers(reissue?.headers).has("Content-Type")).toBe(false);
    expect(save).not.toHaveBeenCalled();
    expectCookieRequests();
  });

  it("동시에 받은 401을 재발급 요청 하나로 처리할 수 있다.", async () => {
    await login();
    const pending = deferred<Response>();
    fetchMock
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(unauthorized())
      .mockReturnValueOnce(pending.promise)
      .mockImplementation(async () => jsonResponse(userFixture()));

    const requests = [session.verifyAdmin(), session.verifyAdmin()];
    await vi.waitFor(() => expect(requestsTo("/auth/reissue")).toHaveLength(1));
    pending.resolve(noContent());
    await Promise.all(requests);

    expect(requestsTo("/auth/reissue")).toHaveLength(1);
    expect(requestsTo("/admin/me")).toHaveLength(4);
    expectCookieRequests();
  });

  it("늦게 도착한 401도 추가 재발급 없이 재시도할 수 있다.", async () => {
    await login();
    const late = deferred<Response>();
    fetchMock
      .mockResolvedValueOnce(unauthorized())
      .mockReturnValueOnce(late.promise)
      .mockResolvedValueOnce(noContent())
      .mockImplementation(async () => jsonResponse(userFixture()));

    const first = session.verifyAdmin();
    const second = session.verifyAdmin();
    await first;
    late.resolve(unauthorized());
    await second;

    expect(requestsTo("/auth/reissue")).toHaveLength(1);
    expect(requestsTo("/admin/me")).toHaveLength(4);
  });

  it.each(["재발급", "재시도"])("%s 응답이 401이면 세션을 제거할 수 있다.", async (stage) => {
    await login();
    fetchMock.mockResolvedValueOnce(unauthorized());
    if (stage === "재시도") fetchMock.mockResolvedValueOnce(noContent());
    fetchMock.mockResolvedValueOnce(unauthorized());

    await expect(session.verifyAdmin()).rejects.toMatchObject({ status: 401 });
    expect(session.user.value).toBeNull();
    expect(session.notice.value).toContain("만료");
    expect(requestsTo("/auth/reissue")).toHaveLength(1);
  });

  it("재발급 네트워크 실패 시 세션을 유지하고 재시도할 수 있다.", async () => {
    await login();
    fetchMock
      .mockResolvedValueOnce(unauthorized())
      .mockRejectedValueOnce(new TypeError("offline"));

    await expect(session.verifyAdmin()).rejects.toBeInstanceOf(AuthError);
    expect(session.user.value).toEqual(userFixture());
    fetchMock
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(noContent())
      .mockResolvedValueOnce(jsonResponse(userFixture()));
    await session.verifyAdmin();

    expect(requestsTo("/auth/reissue")).toHaveLength(2);
    expect(session.user.value).toEqual(userFixture());
    expect(session.notice.value).toBe("");
  });

  it("최초 사용자 조회 실패 후 세션 복원을 재시도할 수 있다.", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    expect(await session.restore()).toBe(false);
    fetchMock.mockResolvedValueOnce(jsonResponse(userFixture()));
    expect(await session.restore()).toBe(true);
    expect(session.user.value).toEqual(userFixture());
    expect(requestsTo("/auth/reissue")).toHaveLength(0);
  });

  it("본문 없는 로그아웃 요청 하나로 세션을 종료할 수 있다.", async () => {
    await login();
    fetchMock.mockResolvedValueOnce(noContent());

    await Promise.all([session.logout(), session.logout()]);

    expect(requestsTo("/auth/logout")).toHaveLength(1);
    const logout = requestsTo("/auth/logout")[0]![1];
    expect(logout?.method).toBe("POST");
    expect(logout?.body).toBeUndefined();
    expect(session.user.value).toBeNull();
    expectCookieRequests();
  });

  it("로그아웃 실패 시 사용자 상태를 유지하고 다시 요청할 수 있다.", async () => {
    await login();
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));

    await expect(session.logout()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(session.user.value).toEqual(userFixture());
    expect(session.signingOut.value).toBe(false);
    fetchMock.mockResolvedValueOnce(noContent());
    await session.logout();

    expect(requestsTo("/auth/logout")).toHaveLength(2);
    expect(session.user.value).toBeNull();
  });

  it("진행 중인 재발급이 끝난 뒤 로그아웃할 수 있다.", async () => {
    await login();
    const pending = deferred<Response>();
    fetchMock
      .mockResolvedValueOnce(unauthorized())
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(noContent());

    const refresh = session.revalidate();
    await vi.waitFor(() => expect(requestsTo("/auth/reissue")).toHaveLength(1));
    const logout = session.logout();
    expect(session.signingOut.value).toBe(true);
    expect(requestsTo("/auth/logout")).toHaveLength(0);
    pending.resolve(noContent());
    await Promise.all([refresh, logout]);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/users/me", "/api/users/me", "/api/auth/reissue", "/api/auth/logout",
    ]);
    expect(session.user.value).toBeNull();
  });

  it("늦게 도착한 사용자 조회 응답 후에도 로그아웃 상태를 유지할 수 있다.", async () => {
    await login();
    const pending = deferred<Response>();
    fetchMock
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(noContent());

    const profile = session.revalidate();
    await vi.waitFor(() => expect(requestsTo("/users/me")).toHaveLength(2));
    await session.logout();
    pending.resolve(jsonResponse(userFixture()));
    await profile;

    expect(session.user.value).toBeNull();
    expect(await session.restore()).toBe(false);
  });

  it("관리자 권한 거절 시 재발급 없이 세션을 유지할 수 있다.", async () => {
    await login();
    fetchMock.mockResolvedValueOnce(jsonResponse({ code: "FORBIDDEN" }, 403));

    await expect(session.verifyAdmin()).rejects.toMatchObject({ status: 403 });
    expect(requestsTo("/auth/reissue")).toHaveLength(0);
    expect(session.user.value).toEqual(userFixture());
  });

  it("요청의 Bearer 헤더를 제거하고 쿠키로 인증할 수 있다.", async () => {
    await login();
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await session.authorizedRequest("/articles", {
      credentials: "omit",
      headers: { Authorization: "Bearer old-token" },
    });

    expectCookieRequests();
  });

  it("브라우저 저장소가 차단되어도 로그인할 수 있다.", async () => {
    session = createAuthSession({
      fetch: fetchMock,
      storage: () => { throw new Error("blocked"); },
    });
    await login();
    expect(session.user.value).toEqual(userFixture());
  });

  it("다른 탭의 재발급 후 사용자 조회로 중복 재발급을 방지할 수 있다.", async () => {
    let queue = Promise.resolve();
    const locks = {
      request: vi.fn((_name: string, action: () => Promise<void>) => {
        const pending = queue.then(action);
        queue = pending.catch(() => undefined);
        return pending;
      }),
    };
    vi.stubGlobal("navigator", { locks });
    await login();
    const other = createAuthSession({ fetch: fetchMock, storage: () => storage });
    fetchMock.mockResolvedValueOnce(jsonResponse(userFixture()));
    await other.completeOAuthLogin();

    const rotation = deferred<Response>();
    let expired = true;
    let adminRequests = 0;
    fetchMock.mockImplementation(async (url) => {
      if (url === "/api/auth/reissue") {
        const response = await rotation.promise;
        expired = false;
        return response;
      }
      if (url === "/api/admin/me") {
        adminRequests++;
        return adminRequests <= 2 ? unauthorized() : jsonResponse(userFixture());
      }
      return expired ? unauthorized() : jsonResponse(userFixture());
    });

    const first = session.verifyAdmin();
    const second = other.verifyAdmin();
    await vi.waitFor(() => {
      expect(locks.request).toHaveBeenCalledTimes(2);
      expect(requestsTo("/auth/reissue")).toHaveLength(1);
    });
    rotation.resolve(noContent());
    await Promise.all([first, second]);

    expect(requestsTo("/auth/reissue")).toHaveLength(1);
    expect(requestsTo("/users/me")).toHaveLength(4);
    expect(session.user.value).toEqual(userFixture());
    expect(other.user.value).toEqual(userFixture());
  });
});
