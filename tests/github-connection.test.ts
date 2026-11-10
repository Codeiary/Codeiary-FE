import { afterEach, describe, expect, it, vi } from "vitest";
import { auth } from "@/store/auth";
import { mount, flushPromises } from "@vue/test-utils";
import GitHubBlogConnection from "@/components/profile/GitHubBlogConnection.vue";
import { githubLinkUrl, consumeOAuthAttempt } from "@/utils/auth/oauth";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); sessionStorage.clear(); });
describe("GitHub OAuth 연동 시작", () => {
  it("미연동 상태에서는 입력칸 없이 연결 버튼만 표시한다", async () => {
    vi.spyOn(auth, "authorizedRequest").mockResolvedValue({ connected: false, login: null });
    const wrapper = mount(GitHubBlogConnection);
    await flushPromises();
    expect(wrapper.findAll("input")).toHaveLength(0);
    expect(wrapper.get(".github-footer button").text()).toBe("GitHub 연결");
    wrapper.unmount();
  });
  it("연동된 계정과 GitHub 프로필 링크를 표시한다", async () => {
    vi.spyOn(auth, "authorizedRequest").mockResolvedValue({ connected: true, login: "octocat" });
    const wrapper = mount(GitHubBlogConnection);
    await flushPromises();
    expect(wrapper.get(".github-account").text()).toContain("@octocat");
    expect(wrapper.get(".github-account").text()).toContain("연동됨");
    expect(wrapper.get(".github-account a").attributes("href")).toBe("https://github.com/octocat");
    expect(wrapper.find(".github-footer").exists()).toBe(false);
    wrapper.unmount();
  });
  it("연동 해제 후 다시 연결 버튼을 표시한다", async () => {
    const request = vi.spyOn(auth, "authorizedRequest")
      .mockResolvedValueOnce({ connected: true, login: "octocat" })
      .mockResolvedValueOnce(undefined);
    const wrapper = mount(GitHubBlogConnection);
    await flushPromises();
    await wrapper.get(".github-disconnect").trigger("click");
    await flushPromises();
    expect(request).toHaveBeenLastCalledWith("/github/connection", { method: "DELETE" });
    expect(wrapper.find(".github-account").exists()).toBe(false);
    expect(wrapper.get(".github-footer button").text()).toBe("GitHub 연결");
    wrapper.unmount();
  });
  it("별도 API 호출 없이 기존 GitHub OAuth 경로로 이동하고 마이페이지 복귀 정보를 보관한다", () => {
    const request = vi.spyOn(auth, "authorizedRequest");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.codeiary.com");
    expect(githubLinkUrl()).toBe("https://api.codeiary.com/oauth2/authorization/github");
    expect(consumeOAuthAttempt()).toBe("/home");
    expect(request).not.toHaveBeenCalled();
  });
  it("안전하지 않은 운영 인증 주소는 거절한다", () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://example.com");
    expect(() => githubLinkUrl()).toThrow("로그인 연결 주소");
  });
});
