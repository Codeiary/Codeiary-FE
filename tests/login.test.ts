import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import LoginPage from "@/views/LoginView.vue";
import AccountActions from "@/components/AccountActions.vue";
import { auth, AuthError } from "@/store/auth";
import { googleLoginUrl } from "@/utils/auth/oauth";
import { loginDestination } from "@/router/auth-guard";
import { userFixture } from "./fixtures/auth";
vi.mock("@/store/auth", async (original) => {
  const module = await original<typeof import("@/store/auth")>();
  const { ref, shallowRef } = await import("vue");
  return {
    ...module,
    auth: {
      ...module.auth,
      user: shallowRef(null),
      notice: ref(""),
      signingOut: ref(false),
      logout: vi.fn(),
    },
  };
});
vi.mock("@/utils/auth/oauth", async (original) => ({
  ...(await original<typeof import("@/utils/auth/oauth")>()),
  googleLoginUrl: vi.fn(),
}));
const user = auth.user as { value: ReturnType<typeof userFixture> | null };
const wrappers: VueWrapper[] = [];
async function render(
  component: typeof LoginPage | typeof AccountActions = LoginPage,
  path = "/login",
) {
  const page = { template: "<div />" };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", name: "city", component: page },
      { path: "/login", name: "login", component: page },
      { path: "/admin", name: "admin", component: page },
    ],
  });
  await router.push(path);
  const wrapper = mount(component, {
    attachTo: document.body,
    global: { plugins: [router] },
  });
  wrappers.push(wrapper);
  return { wrapper, router };
}
describe("Google 로그인 화면", () => {
  beforeEach(() => {
    user.value = null;
    vi.mocked(auth.logout).mockReset();
    vi.mocked(googleLoginUrl).mockReset();
  });
  afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()));
  it("기존 이메일과 비밀번호 입력 없이 Google 로그인만 표시할 수 있다.", async () => {
    const { wrapper } = await render();
    expect(wrapper.find("input").exists()).toBe(false);
    expect(wrapper.get(".google-signin").text()).toBe("Google로 계속하기");
    expect(wrapper.get(".auth-browse").attributes("href")).toBe("/");
  });
  it("Google 연결을 시작하지 못해도 오류를 안내하고 재시도할 수 있다.", async () => {
    vi.mocked(googleLoginUrl).mockImplementation(() => {
      throw new Error("로그인 연결을 확인해 주세요.");
    });
    const { wrapper } = await render(
      LoginPage,
      "/login?redirect=/blog/test/post",
    );
    await wrapper.get(".google-signin").trigger("click");
    expect(googleLoginUrl).toHaveBeenCalledWith("/blog/test/post");
    expect(wrapper.get('[role="alert"]').text()).toContain("연결");
    expect(
      wrapper.get(".google-signin").attributes("disabled"),
    ).toBeUndefined();
  });
  it("내부 게시글로 복귀하고 외부 주소는 차단할 수 있다.", () => {
    expect(loginDestination("/blog/커밋여행자/기록")).toBe(
      "/blog/커밋여행자/기록",
    );
    for (const target of ["https://example.com", "//example.com", "/unknown"])
      expect(loginDestination(target)).toBe("/");
  });
  it("로그인 상태에 따라 헤더의 버튼을 전환할 수 있다.", async () => {
    const { wrapper } = await render(AccountActions, "/");
    expect(wrapper.find('a[href="/login"]').exists()).toBe(true);
    user.value = userFixture();
    await flushPromises();
    expect(wrapper.find('a[href="/admin"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("로그아웃");
    user.value = userFixture("USER");
    await flushPromises();
    expect(wrapper.find('a[href="/admin"]').exists()).toBe(false);
  });

  it("로그아웃 실패 시 오류를 안내하고 페이지를 유지할 수 있다.", async () => {
    user.value = userFixture();
    vi.mocked(auth.logout).mockRejectedValue(
      new AuthError(0, "NETWORK_ERROR", "연결을 확인해 주세요."),
    );
    const { wrapper, router } = await render(AccountActions, "/admin");
    await wrapper.get(".account-button").trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain("연결");
    expect(router.currentRoute.value.name).toBe("admin");
  });
});
