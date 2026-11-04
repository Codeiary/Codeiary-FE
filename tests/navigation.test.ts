import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { auth, AuthError } from "@/store/auth";
import { authGuard, loginDestination } from "@/router/auth-guard";
import { homeRoute } from "@/utils/profile/home-route";
import { userFixture } from "./fixtures/auth";
import SiteHeader from "@/components/SiteHeader.vue";

vi.mock("@/store/auth", async (original) => {
  const module = await original<typeof import("@/store/auth")>();
  const { shallowRef, computed } = await import("vue");
  const user = shallowRef<ReturnType<typeof userFixture> | null>(null);
  return {
    ...module,
    auth: {
      user,
      needsOnboarding: computed(
        () => user.value?.onboardingCompleted === false,
      ),
      restore: vi.fn(),
      verifyAdmin: vi.fn(),
    },
  };
});
vi.mock("@/services/profile-api", () => ({ fetchHomeProfile: vi.fn(async () => ({ owner: { id: 2, nickname: "이웃", name: "이웃" }, email: "", github: "" })) }));
const user = auth.user as { value: ReturnType<typeof userFixture> | null };
const headers: VueWrapper[] = [];
afterEach(() => headers.splice(0).forEach((header) => header.unmount()));

it("닉네임이 있으면 내 집 링크를 루트 닉네임 주소로 통일한다", () => {
  expect(homeRoute({ nickname: "기록자" })).toEqual({ name: "user-profile", params: { nickname: "기록자" }, query: {} });
  expect(homeRoute({ nickname: "blog" }).name).toBe("user-home");
});

async function renderHeader() {
  const component = { template: "<div />" };
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: "/", name: "city", component },
    { path: "/blog", name: "blog", component },
    { path: "/portfolio", name: "portfolio", component },
    { path: "/news", name: "news", component },
    { path: "/home", name: "user-home", component },
    { path: "/:nickname", name: "user-profile", component },
    { path: "/blog/:authorSlug", name: "user-blog", component },
    { path: "/portfolio/manage", name: "portfolio-manage", component },
  ] });
  await router.push("/");
  const wrapper = mount(SiteHeader, { attachTo: document.body, global: { plugins: [router], stubs: { AccountActions: true } } });
  headers.push(wrapper);
  return { wrapper, router };
}

describe("공통 헤더", () => {
  it("로그인한 사용자는 집 아이콘으로 마이페이지에 바로 진입한다", async () => {
    user.value = null;
    const { wrapper, router } = await renderHeader();
    expect(wrapper.findAll('.site-primary-navigation button').map((button) => button.text())).toEqual(["블로그", "포트폴리오", "최근 IT 이슈"]);
    expect(wrapper.findAll('.site-menu-panel button').map((button) => button.text())).toEqual(["블로그", "포트폴리오", "최근 IT 이슈"]);
    expect(wrapper.find(".mypage-link").exists()).toBe(false);
    user.value = userFixture("USER");
    await flushPromises();
    expect(wrapper.find("details").exists()).toBe(false);
    expect(wrapper.get('.mypage-link').attributes('href')).toBe("/home");
    await wrapper.get('.site-menu-toggle').trigger("click");
    await wrapper.get('.mypage-link').trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("user-home");
    expect(wrapper.get('.site-menu-toggle').attributes('aria-expanded')).toBe("false");
  });

  it("전체 메뉴는 바깥 클릭과 Esc로 닫을 수 있다", async () => {
    user.value = userFixture("USER");
    const { wrapper } = await renderHeader();
    await wrapper.get('.site-menu-toggle').trigger("click");
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await flushPromises();
    expect(wrapper.get('.site-menu-toggle').attributes('aria-expanded')).toBe("false");
    await wrapper.get('.site-menu-toggle').trigger("click");
    await wrapper.get('.site-menu-panel button').trigger("keydown", { key: "Escape" });
    expect(wrapper.get('.site-menu-toggle').attributes('aria-expanded')).toBe("false");
    expect(document.activeElement).toBe(wrapper.get('.site-menu-toggle').element);
  });
});

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
        { path: "/home", name: "user-home", component },
    { path: "/:nickname", name: "user-profile", component },
        { path: "/login", name: "login", component },
        {
          path: "/onboarding",
          name: "onboarding",
          component,
          meta: { requiresAuth: true },
        },
        { path: "/auth/callback", name: "oauth-callback", component },
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
  it("신규 사용자는 온보딩을 완료해야 글쓰기로 이동할 수 있다.", async () => {
    user.value = { ...userFixture("USER"), onboardingCompleted: false };
    const router = routerFixture();
    await router.push("/write");
    expect(router.currentRoute.value.name).toBe("onboarding");
    expect(router.currentRoute.value.query.redirect).toBe("/write");
    user.value = { ...user.value, onboardingCompleted: true };
    await router.push("/write");
    expect(router.currentRoute.value.name).toBe("blog-write");
  });
  it("비로그인 사용자를 로그인으로 안내할 수 있다.", async () => {
    const router = routerFixture();
    await router.push("/admin");
    expect(router.currentRoute.value.fullPath).toBe("/login?redirect=/admin");
    expect(auth.verifyAdmin).not.toHaveBeenCalled();
  });
  it("이웃집은 공개하고 내 집은 로그인한 사용자만 방문할 수 있다.", async () => {
    const router = routerFixture();
    await router.push("/home?resident=2");
    expect(router.currentRoute.value.name).toBe("user-profile");
    expect(router.currentRoute.value.params.nickname).toBe("이웃");
    await router.push("/home");
    expect(router.currentRoute.value.fullPath).toBe("/login?redirect=/home");
    user.value = userFixture("USER");
    await router.push("/home");
    expect(router.currentRoute.value.name).toBe("user-home");
    expect(loginDestination("/home")).toBe("/home");
  });
  it("글쓰기 진입 시 로그인 후 편집 화면으로 돌아올 수 있다.", async () => {
    const router = routerFixture();
    await router.push("/write");
    expect(router.currentRoute.value.name).toBe("login");
    expect(router.currentRoute.value.query.redirect).toBe("/write");
    expect(loginDestination("/write")).toBe("/write");
    expect(loginDestination("/write//evil.example")).toBe("/");
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
  it("외부 주소로의 로그인 리다이렉트를 차단할 수 있다.", () => {
    user.value = userFixture();
    expect(loginDestination("https://example.com")).toBe("/");
    expect(loginDestination("//example.com")).toBe("/");
    expect(loginDestination(["/admin"])).toBe("/");
    expect(loginDestination("/admin")).toBe("/admin");
  });
});
