import { afterEach, describe, expect, it } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import UserHome from "../src/profile/UserHome.vue";
import { createMockHome, homeBlogPosts } from "../src/profile/mock-home";
import { userFixture } from "./fixtures/auth";
import { blogPostsFixture, postFixture } from "./fixtures/blog";

const wrappers: VueWrapper[] = [];
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()));
function render() {
  const user = userFixture("USER");
  const profile = createMockHome(user);
  const wrapper = mount(UserHome, {
    props: {
      profile,
      posts: homeBlogPosts(blogPostsFixture(), profile.owner, user.id),
    },
    attachTo: document.body,
  });
  wrappers.push(wrapper);
  return wrapper;
}

describe("사용자의 집", () => {
  it("로그인한 사용자의 이름과 이메일 및 GitHub 링크를 표시할 수 있다.", () => {
    const wrapper = render();
    expect(wrapper.get(".home-profile h3").text()).toBe(
      userFixture("USER").name,
    );
    expect(wrapper.get('a[href^="mailto:"]').attributes("href")).toBe(
      `mailto:${userFixture("USER").email}`,
    );
    expect(
      wrapper.get('a[href^="https://github.com/"]').attributes("rel"),
    ).toContain("noopener");
    expect(wrapper.get(".home-profile").text()).not.toContain("ADMIN");
  });
  it("다른 사용자의 비공개 글을 제외하고 내 글을 최신순으로 확인할 수 있다.", () => {
    const author = { id: 1, name: "기록자" };
    expect(
      homeBlogPosts(blogPostsFixture(), author, 1).map((post) => post.id),
    ).toEqual([1, 3]);
    expect(
      homeBlogPosts(blogPostsFixture(), author, 2).map((post) => post.id),
    ).toEqual([1]);
    expect(
      homeBlogPosts(blogPostsFixture(), author).map((post) => post.id),
    ).toEqual([1]);
  });
  it("내 블로그와 개별 게시글 열기를 요청할 수 있다.", async () => {
    const wrapper = render();
    await wrapper.get(".home-section-action button").trigger("click");
    expect(wrapper.emitted("blog")).toHaveLength(1);
    await wrapper.findAll(".post-open")[1]!.trigger("click");
    expect(wrapper.emitted("post")?.[0]?.[0]).toMatchObject({
      id: 3,
      visibility: "PRIVATE",
    });
  });
  it("포트폴리오와 작성한 IT 이슈의 목록과 상세를 확인할 수 있다.", async () => {
    const wrapper = render();
    await wrapper.get("#home-tab-portfolio").trigger("click");
    expect(wrapper.findAll(".home-entry")).toHaveLength(2);
    await wrapper.findAll(".home-entry")[0]!.trigger("click");
    expect(wrapper.get(".home-entry-detail h3").text()).toBe("Codeiary");
    await wrapper.get(".home-detail-back").trigger("click");
    expect(wrapper.findAll(".home-entry")).toHaveLength(2);
    await wrapper.get("#home-tab-issues").trigger("click");
    await wrapper.findAll(".home-entry")[0]!.trigger("click");
    expect(wrapper.get(".home-entry-detail h3").text()).toContain("3D 웹");
  });
  it("키보드로 탭을 이동하고 계정이 바뀌면 이전 상세를 닫을 수 있다.", async () => {
    const wrapper = render();
    await wrapper
      .get("#home-tab-blog")
      .trigger("keydown", { key: "ArrowRight" });
    await flushPromises();
    expect(document.activeElement?.id).toBe("home-tab-portfolio");
    await wrapper.get("#home-tab-portfolio").trigger("keydown", { key: "End" });
    await flushPromises();
    expect(wrapper.get("#home-tab-issues").attributes("aria-selected")).toBe(
      "true",
    );
    await wrapper.findAll(".home-entry")[0]!.trigger("click");
    const next = createMockHome({
      ...userFixture("USER"),
      id: 2,
      name: "다음 사용자",
    });
    await wrapper.setProps({
      profile: next,
      posts: [postFixture({ id: 7, author: next.owner })],
    });
    expect(wrapper.find(".home-entry-detail").exists()).toBe(false);
    expect(wrapper.get("#home-tab-blog").attributes("aria-selected")).toBe(
      "true",
    );
    expect(wrapper.get(".home-profile h3").text()).toBe("다음 사용자");
  });
});
