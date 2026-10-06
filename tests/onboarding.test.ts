import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import OnboardingView from "@/views/OnboardingView.vue";
import { auth, AuthError } from "@/store/auth";
import { deferred, userFixture } from "./fixtures/auth";
vi.mock("@/store/auth", async (original) => {
  const module = await original<typeof import("@/store/auth")>();
  const { shallowRef } = await import("vue");
  return {
    ...module,
    auth: {
      ...module.auth,
      user: shallowRef(null),
      checkNickname: vi.fn(),
      completeOnboarding: vi.fn(),
    },
  };
});
const user = auth.user as { value: ReturnType<typeof userFixture> | null };
const wrappers: VueWrapper[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  user.value = { ...userFixture("USER"), onboardingCompleted: false };
  vi.mocked(auth.checkNickname).mockReset();
  vi.mocked(auth.completeOnboarding).mockReset();
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.useRealTimers();
});
async function render() {
  const page = { template: "<div/>" };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/onboarding", name: "onboarding", component: page },
      { path: "/", component: page },
      { path: "/blog/writer/post", component: page },
    ],
  });
  await router.push("/onboarding?redirect=/blog/writer/post");
  const wrapper = mount(OnboardingView, { global: { plugins: [router] } });
  wrappers.push(wrapper);
  return { wrapper, router };
}
describe("온보딩 화면", () => {
  it("늦게 도착한 이전 닉네임 검사 결과가 현재 입력을 덮어쓰지 않게 할 수 있다.", async () => {
    const old = deferred<{ available: boolean }>();
    vi.mocked(auth.checkNickname)
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce({ available: false });
    const { wrapper } = await render();
    await wrapper.get("#onboarding-nickname").setValue("첫이름");
    await vi.advanceTimersByTimeAsync(350);
    await wrapper.get("#onboarding-nickname").setValue("다른이름");
    await vi.advanceTimersByTimeAsync(350);
    expect(wrapper.get("#nickname-help").text()).toContain("사용 중");
    old.resolve({ available: true });
    await flushPromises();
    expect(wrapper.get("#nickname-help").text()).toContain("사용 중");
  });
  it("사진 없이 닉네임만 저장하고 원래 게시글로 돌아갈 수 있다.", async () => {
    vi.mocked(auth.checkNickname).mockResolvedValue({ available: true });
    vi.mocked(auth.completeOnboarding).mockResolvedValue();
    const { wrapper, router } = await render();
    await wrapper.get("#onboarding-nickname").setValue("커밋산책");
    await vi.advanceTimersByTimeAsync(350);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(auth.completeOnboarding).toHaveBeenCalledWith("커밋산책", null);
    expect(router.currentRoute.value.path).toBe("/blog/writer/post");
  });
  it("저장 시 닉네임이 중복되어도 입력을 유지하고 다시 선택할 수 있다.", async () => {
    vi.mocked(auth.checkNickname).mockResolvedValue({ available: true });
    vi.mocked(auth.completeOnboarding).mockRejectedValue(
      new AuthError(409, "NICKNAME_TAKEN", "이미 사용 중인 닉네임이에요."),
    );
    const { wrapper } = await render();
    await wrapper.get("#onboarding-nickname").setValue("커밋산책");
    await vi.advanceTimersByTimeAsync(350);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get("#nickname-help").text()).toContain("사용 중");
    expect(
      (wrapper.get("input[type=text]").element as HTMLInputElement).value,
    ).toBe("커밋산책");
    expect(
      wrapper.get("input[type=text]").attributes("disabled"),
    ).toBeUndefined();
  });
});
