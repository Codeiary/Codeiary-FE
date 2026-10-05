import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import LoginPage from "../src/pages/LoginPage.vue";
import AccountActions from "../src/components/AccountActions.vue";
import { auth, AuthError } from "../src/auth/session";
import { credentials, deferred, userFixture } from "./fixtures/auth";

vi.mock("../src/auth/session", async (original) => {
  const module = await original<typeof import("../src/auth/session")>();
  const { ref, shallowRef } = await import("vue");
  return {
    ...module,
    auth: {
      user: shallowRef(null),
      notice: ref(""),
      signingOut: ref(false),
      login: vi.fn(),
      logout: vi.fn(),
    },
  };
});
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
async function fillForm(wrapper: VueWrapper) {
  await wrapper.get("#login-email").setValue(credentials.email);
  await wrapper.get("#login-password").setValue(credentials.password);
}

describe("로그인 화면", () => {
  beforeEach(() => {
    user.value = null;
    vi.mocked(auth.login).mockReset();
    vi.mocked(auth.logout).mockReset();
  });
  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  });

  it("빈 입력을 안내하고 첫 번째 오류 필드로 이동할 수 있다.", async () => {
    const { wrapper } = await render();
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get("#email-error").text()).toContain("입력해");
    expect(document.activeElement?.id).toBe("login-email");
    expect(auth.login).not.toHaveBeenCalled();
  });

  it("대문자 이메일을 자동 변환하지 않고 수정을 요청할 수 있다.", async () => {
    const { wrapper } = await render();
    await fillForm(wrapper);
    await wrapper.get("#login-email").setValue("Writer@example.com");
    await wrapper.get("form").trigger("submit");
    expect(wrapper.get("#email-error").text()).toContain("소문자");
    expect(
      (wrapper.get("#login-email").element as HTMLInputElement).value,
    ).toBe("Writer@example.com");
    expect(auth.login).not.toHaveBeenCalled();
  });

  it("비밀번호를 표시하고 다시 숨길 수 있다.", async () => {
    const { wrapper } = await render();
    await wrapper.get("button[aria-label='비밀번호 보기']").trigger("click");
    expect(wrapper.get("#login-password").attributes("type")).toBe("text");
    await wrapper.get("button[aria-label='비밀번호 숨기기']").trigger("click");
    expect(wrapper.get("#login-password").attributes("type")).toBe("password");
  });

  it("중복 제출을 막고 성공 후 메인으로 이동할 수 있다.", async () => {
    const pending = deferred<void>();
    vi.mocked(auth.login).mockReturnValue(pending.promise);
    const { wrapper, router } = await render();
    await fillForm(wrapper);
    await wrapper.get("form").trigger("submit");
    await wrapper.get("form").trigger("submit");
    expect(auth.login).toHaveBeenCalledOnce();
    expect(
      wrapper.get("button[type='submit']").attributes("disabled"),
    ).toBeDefined();
    pending.resolve();
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("city");
    expect(
      (wrapper.get("#login-password").element as HTMLInputElement).value,
    ).toBe("");
  });

  it("인증 실패를 안내하고 재시도할 수 있다.", async () => {
    vi.mocked(auth.login).mockRejectedValueOnce(
      new AuthError(
        401,
        "INVALID_CREDENTIALS",
        "이메일 또는 비밀번호를 확인해 주세요.",
      ),
    );
    const { wrapper } = await render();
    await fillForm(wrapper);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get("[role='alert']").text()).toContain(
      "이메일 또는 비밀번호",
    );
    expect(
      wrapper.get("button[type='submit']").attributes("disabled"),
    ).toBeUndefined();
    expect(
      (wrapper.get("#login-email").element as HTMLInputElement).value,
    ).toBe(credentials.email);
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
