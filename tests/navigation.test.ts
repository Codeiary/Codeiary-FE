import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { auth, AuthError } from "@/store/auth";
import { authGuard, loginDestination } from "@/router/auth-guard";
import { userFixture } from "./fixtures/auth";

vi.mock("@/store/auth", async (original) => {
  const module = await original<typeof import("@/store/auth")>();
  const { shallowRef } = await import("vue");
  return {
    ...module,
    auth: { user: shallowRef(null), restore: vi.fn(), verifyAdmin: vi.fn() },
  };
});
const user = auth.user as { value: ReturnType<typeof userFixture> | null };

describe("인증 라우트", () => {
  beforeEach(() => {
    user.value = null;
    vi.mocked(auth.verifyAdmin).mockReset();
  });
  function routerFixture() {
    const component = { template: "<div />" };
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", name: "city", component },
        { path: "/login", name: "login", component },
        {
          path: "/write/:draftId?",
          name: "blog-write",
          component,
          meta: { requiresAuth: true },
        },
        {
          path: "/admin",
          name: "admin",
          component,
          meta: { requiresAdmin: true },
        },
      ],
    });
    router.beforeEach(authGuard);
    return router;
  }
  it("비로그인 사용자를 로그인으로 안내할 수 있다.", async () => {
    const router = routerFixture();
    await router.push("/admin");
    expect(router.currentRoute.value.fullPath).toBe("/login?redirect=/admin");
    expect(auth.verifyAdmin).not.toHaveBeenCalled();
  });
  it("글쓰기 진입 시 로그인 후 편집 화면으로 돌아올 수 있다.", async () => {
    const router = routerFixture();
    await router.push("/write");
    expect(router.currentRoute.value.name).toBe("login");
    expect(router.currentRoute.value.query.redirect).toBe("/write");
    expect(loginDestination("/write")).toBe("/write");
    expect(loginDestination("/write//evil.example")).toBe("/");
  });
  it("일반 사용자도 글쓰기 화면에 접근할 수 있다.", async () => {
    user.value = userFixture("USER");
    const router = routerFixture();
    await router.push("/write");
    expect(router.currentRoute.value.name).toBe("blog-write");
    expect(auth.verifyAdmin).not.toHaveBeenCalled();
  });
  it("서버에서 승인한 관리자만 관리자 화면에 접근할 수 있다.", async () => {
    user.value = userFixture();
    const router = routerFixture();
    await router.push("/admin");
    expect(auth.verifyAdmin).toHaveBeenCalledOnce();
    expect(router.currentRoute.value.name).toBe("admin");
  });
  it("서버에서 권한이 거절된 사용자를 메인으로 이동시킬 수 있다.", async () => {
    user.value = userFixture();
    vi.mocked(auth.verifyAdmin).mockRejectedValue(
      new AuthError(403, "FORBIDDEN", "denied"),
    );
    const router = routerFixture();
    await router.push("/admin");
    expect(router.currentRoute.value.fullPath).toBe("/?access=denied");
  });
  it("서버 오류 시 반복 리다이렉트 없이 로그인을 안내할 수 있다.", async () => {
    user.value = userFixture();
    vi.mocked(auth.verifyAdmin).mockRejectedValue(
      new AuthError(0, "NETWORK_ERROR", "offline"),
    );
    const router = routerFixture();
    await router.push("/admin");
    expect(router.currentRoute.value.name).toBe("login");
    expect(router.currentRoute.value.query.retry).toBe("1");
    expect(auth.verifyAdmin).toHaveBeenCalledOnce();
  });
  it("로그인한 사용자의 중복 로그인을 막을 수 있다.", async () => {
    user.value = userFixture("USER");
    const router = routerFixture();
    await router.push("/login?redirect=/admin");
    expect(router.currentRoute.value.name).toBe("city");
  });
  it("외부 주소로의 로그인 리다이렉트를 차단할 수 있다.", () => {
    user.value = userFixture();
    expect(loginDestination("https://example.com")).toBe("/");
    expect(loginDestination("//example.com")).toBe("/");
    expect(loginDestination(["/admin"])).toBe("/");
    expect(loginDestination("/admin")).toBe("/admin");
  });
});
