import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createWebHistory, createRouter } from "vue-router";
import CityApp from "@/views/CityView.vue";
import { auth, type UserProfile } from "@/store/auth";
import { userFixture } from "./fixtures/auth";
import { cityRoutes } from "@/router/city-routes";
import { mockAccountProgress } from "@/services/mock-neighborhood";
import { blogPostsFixture } from "./fixtures/blog";

const setHome = vi.hoisted(() => vi.fn());
const blogApiMock = vi.hoisted(() => ({
  posts: [] as import("@/utils/blog/posts").BlogPost[],
  userId: 1,
}));

vi.mock("@/services/blog-api", () => ({
  fetchPosts: async ({ mine }: { mine?: boolean } = {}) =>
    blogApiMock.posts.filter((post) =>
      mine
        ? post.author?.id === blogApiMock.userId
        : post.visibility !== "PRIVATE",
    ),
  fetchPost: async (id: number) =>
    blogApiMock.posts.find((post) => post.id === id),
  removePost: vi.fn(),
}));
vi.mock("@/store/auth", async () => {
  const { shallowRef } = await import("vue");
  return { auth: { user: shallowRef(null) } };
});
vi.mock("@/utils/city/world", () => ({
  createCity: () => ({
    setPaused: vi.fn(),
    setNight: vi.fn(),
    dispose: vi.fn(),
    setInput: vi.fn(),
    setJoystick: vi.fn(),
    setRunning: vi.fn(),
    setHome,
    setNeighborhood: vi.fn(),
    goToDistrict: vi.fn(),
    visitResidence: vi.fn(),
  }),
}));

const user = auth.user as { value: UserProfile | null };
const wrappers: VueWrapper[] = [];
async function render() {
  window.history.replaceState({}, "", "/");
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      ...cityRoutes,
      {
        path: "/write/:draftId?",
        name: "blog-write",
        component: { template: "<div />" },
      },
    ],
  });
  await router.push("/blog");
  const wrapper = mount(CityApp, {
    attachTo: document.body,
    global: { plugins: [router], stubs: { AccountActions: true } },
  });
  wrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}
function titles(wrapper: VueWrapper) {
  return wrapper.findAll(".post-card h3").map((card) => card.text());
}

describe("블로그 글 목록", () => {
  beforeEach(() => {
    user.value = null;
    setHome.mockClear();
    blogApiMock.posts = blogPostsFixture();
    blogApiMock.userId = 1;
  });
  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => {
      wrapper.vm.$router.options.history.destroy();
      wrapper.unmount();
    });
  });

  it("비로그인 사용자는 내 블로그 버튼 없이 발행된 글만 볼 수 있다.", async () => {
    const wrapper = await render();
    expect(wrapper.find(".blog-my-posts").exists()).toBe(false);
    expect(titles(wrapper)).toEqual([
      "나의 Vue 기록",
      "다른 사람의 글",
      "기존 예시 글",
    ]);
  });

  it("로그인과 계정 전환 및 로그아웃에 맞춰 메인 집 레벨을 갱신할 수 있다.", async () => {
    mockAccountProgress[1] = { level: 5, activityPoints: null };
    mockAccountProgress[2] = { level: 1, activityPoints: null };
    try {
      await render();
      expect(setHome).toHaveBeenLastCalledWith(null);
      user.value = userFixture("USER");
      await flushPromises();
      expect(setHome).toHaveBeenLastCalledWith(5);
      user.value = { ...userFixture("USER"), id: 2 };
      blogApiMock.userId = 2;
      await flushPromises();
      expect(setHome).toHaveBeenLastCalledWith(1);
      user.value = null;
      await flushPromises();
      expect(setHome).toHaveBeenLastCalledWith(null);
    } finally {
      delete mockAccountProgress[1];
      delete mockAccountProgress[2];
    }
  });

  it("내 블로그에서 본인 글과 비공개 글을 볼 수 있다.", async () => {
    user.value = userFixture("USER");
    blogApiMock.userId = user.value.id;
    const wrapper = await render();
    await wrapper.get('[aria-label="내 블로그 보기"]').trigger("click");
    await flushPromises();
    expect(wrapper.get("#content-panel-title").text()).toBe("기록자의 블로그");
    expect(titles(wrapper)).toEqual(["나의 Vue 기록", "나의 비공개 글"]);
    expect(wrapper.get(".post-visibility").text()).toBe("비공개");
    wrapper.vm.$router.back();
    await flushPromises();
    expect(titles(wrapper)).toEqual([
      "나의 Vue 기록",
      "다른 사람의 글",
      "기존 예시 글",
    ]);
  });

  it.each([null, "USER", "ADMIN"] as const)(
    "%s 권한으로 타인의 비공개 글 주소를 직접 열어도 본문을 숨길 수 있다.",
    async (role) => {
      user.value = role ? userFixture(role) : null;
      const wrapper = await render();
      await wrapper.vm.$router.push("/blog/다른-기록자/다른-사람의-비공개-글");
      await flushPromises();
      expect(wrapper.find(".article-body").exists()).toBe(false);
      expect(wrapper.get(".blog-empty-state").text()).toContain(
        "찾을 수 없어요",
      );
    },
  );

  it("로그아웃하면 열어 둔 비공개 글을 닫고 전체 글로 돌아갈 수 있다.", async () => {
    user.value = userFixture("USER");
    const wrapper = await render();
    await wrapper.get('[aria-label="내 블로그 보기"]').trigger("click");
    await flushPromises();
    await wrapper.findAll(".post-open")[1]!.trigger("click");
    await flushPromises();
    expect(wrapper.get(".article-body h2").text()).toBe("나의 비공개 글");
    user.value = null;
    await flushPromises();
    expect(wrapper.find(".article-body").exists()).toBe(false);
    expect(wrapper.find(".blog-my-posts").exists()).toBe(false);
    expect(wrapper.get("#content-panel-title").text()).toBe("Blog House");
    expect(titles(wrapper)).not.toContain("나의 비공개 글");
  });

  it("계정이 변경되면 새로운 사용자의 글만 확인할 수 있다.", async () => {
    user.value = userFixture("USER");
    const wrapper = await render();
    await wrapper.get('[aria-label="내 블로그 보기"]').trigger("click");
    await flushPromises();
    user.value = { ...userFixture("USER"), id: 2 };
    blogApiMock.userId = 2;
    await flushPromises();
    expect(wrapper.get("#content-panel-title").text()).toBe("Blog House");
    await wrapper.get('[aria-label="내 블로그 보기"]').trigger("click");
    await flushPromises();
    expect(titles(wrapper)).toEqual([
      "다른 사람의 글",
      "다른 사람의 비공개 글",
    ]);
  });

  it("전체 글을 조회순으로 정렬하고 조회수가 같으면 최신 글부터 볼 수 있다.", async () => {
    const wrapper = await render();
    await wrapper.findAll(".post-sort button")[1]!.trigger("click");
    await flushPromises();
    expect(titles(wrapper)).toEqual([
      "다른 사람의 글",
      "기존 예시 글",
      "나의 Vue 기록",
    ]);
    expect(
      wrapper.findAll(".post-sort button")[1]!.attributes("aria-pressed"),
    ).toBe("true");
    await wrapper.findAll(".post-sort button")[0]!.trigger("click");
    await flushPromises();
    expect(titles(wrapper)).toEqual([
      "나의 Vue 기록",
      "다른 사람의 글",
      "기존 예시 글",
    ]);
  });

  it("검색어나 정렬을 바꾸면 첫 페이지부터 확인할 수 있다.", async () => {
    const wrapper = await render();
    await wrapper.vm.$router.push("/blog?page=2");
    await flushPromises();
    await wrapper.get('input[aria-label="블로그 글 검색"]').setValue("Vue");
    await flushPromises();
    expect(wrapper.vm.$router.currentRoute.value.query).toEqual({ q: "Vue" });
    await wrapper.vm.$router.push("/blog?q=Vue&page=2");
    await flushPromises();
    await wrapper.findAll(".post-sort button")[1]!.trigger("click");
    await flushPromises();
    expect(wrapper.vm.$router.currentRoute.value.query).toEqual({
      q: "Vue",
      sort: "views",
    });
    expect(
      wrapper.get('[aria-current="page"][aria-label="1페이지"]').text(),
    ).toBe("1");
  });

  it("전체 글을 검색하고 결과가 없으면 검색어를 초기화할 수 있다.", async () => {
    const wrapper = await render();
    await wrapper.get('input[aria-label="블로그 글 검색"]').setValue("  vue  ");
    await flushPromises();
    expect(titles(wrapper)).toHaveLength(3);
    await wrapper
      .get('input[aria-label="블로그 글 검색"]')
      .setValue("다른 사람");
    await flushPromises();
    expect(titles(wrapper)).toEqual(["다른 사람의 글"]);
    await wrapper.get('input[aria-label="블로그 글 검색"]').setValue("없는 글");
    await flushPromises();
    expect(wrapper.get(".blog-empty-state").text()).toContain(
      "찾는 이야기가 아직 없어요",
    );
    await wrapper.get(".blog-empty-state button").trigger("click");
    await flushPromises();
    expect(titles(wrapper)).toHaveLength(3);
  });

  it("내 블로그에서 뒤로가면 이전 검색어와 정렬을 유지할 수 있다.", async () => {
    user.value = userFixture("USER");
    const wrapper = await render();
    await wrapper.findAll(".post-sort button")[1]!.trigger("click");
    await flushPromises();
    await wrapper
      .get('input[aria-label="블로그 글 검색"]')
      .setValue("다른 사람");
    await flushPromises();
    await wrapper.get('[aria-label="내 블로그 보기"]').trigger("click");
    await flushPromises();
    expect(wrapper.find(".search-input").exists()).toBe(true);
    expect(wrapper.find(".post-sort").exists()).toBe(false);
    expect(titles(wrapper)).toEqual(["나의 Vue 기록", "나의 비공개 글"]);
    wrapper.vm.$router.back();
    await flushPromises();
    expect(titles(wrapper)).toEqual(["다른 사람의 글"]);
    expect(
      (wrapper.get(".search-input input").element as HTMLInputElement).value,
    ).toBe("다른 사람");
    expect(
      wrapper.findAll(".post-sort button")[1]!.attributes("aria-pressed"),
    ).toBe("true");
  });

  it("내 글이 없으면 첫 글 작성을 시작할 수 있다.", async () => {
    user.value = { ...userFixture("USER"), id: 99 };
    const wrapper = await render();
    await wrapper.get('[aria-label="내 블로그 보기"]').trigger("click");
    await flushPromises();
    expect(titles(wrapper)).toHaveLength(0);
    expect(wrapper.get(".blog-empty-state").text()).toContain(
      "아직 작성한 글이 없어요",
    );
    await wrapper.get(".blog-empty-state button").trigger("click");
    await flushPromises();
    expect(wrapper.vm.$router.currentRoute.value.name).toBe("blog-write");
  });

  it("내 글 상세를 닫으면 내 블로그 목록으로 돌아갈 수 있다.", async () => {
    user.value = userFixture("USER");
    const wrapper = await render();
    await wrapper.get('[aria-label="내 블로그 보기"]').trigger("click");
    await flushPromises();
    await wrapper.findAll(".post-open")[0]!.trigger("click");
    await flushPromises();
    wrapper.vm.$router.back();
    await flushPromises();
    expect(wrapper.get("#content-panel-title").text()).toBe("기록자의 블로그");
    expect(titles(wrapper)).toEqual(["나의 Vue 기록", "나의 비공개 글"]);
  });
  it("다른 작성자의 블로그에서 공개 글만 볼 수 있다.", async () => {
    const wrapper = await render();
    await wrapper
      .get('[aria-label="다른 기록자의 블로그 보기"]')
      .trigger("click");
    await flushPromises();
    expect(wrapper.get("#content-panel-title").text()).toBe(
      "다른 기록자의 블로그",
    );
    expect(titles(wrapper)).toEqual(["다른 사람의 글"]);
    expect(wrapper.find(".article-body").exists()).toBe(false);
    expect(wrapper.find(".search-input").exists()).toBe(true);
    expect(wrapper.find(".post-sort").exists()).toBe(false);
    expect(wrapper.find(".post-visibility").exists()).toBe(false);
    wrapper.vm.$router.back();
    await flushPromises();
    expect(titles(wrapper)).toHaveLength(3);
  });

  it("글 상세에서 작성자의 블로그로 이동하고 내 블로그로 돌아갈 수 있다.", async () => {
    user.value = userFixture("USER");
    const wrapper = await render();
    await wrapper.findAll(".post-open")[1]!.trigger("click");
    await flushPromises();
    await wrapper
      .get('.article-meta [aria-label="다른 기록자의 블로그 보기"]')
      .trigger("click");
    await flushPromises();
    expect(wrapper.find(".article-body").exists()).toBe(false);
    expect(wrapper.get("#content-panel-title").text()).toBe(
      "다른 기록자의 블로그",
    );
    await wrapper.get(".post-open").trigger("click");
    await flushPromises();
    wrapper.vm.$router.back();
    await flushPromises();
    expect(titles(wrapper)).toEqual(["다른 사람의 글"]);
    await wrapper.get('[aria-label="내 블로그 보기"]').trigger("click");
    await flushPromises();
    expect(wrapper.get("#content-panel-title").text()).toBe("기록자의 블로그");
    expect(titles(wrapper)).toEqual(["나의 Vue 기록", "나의 비공개 글"]);
  });

  it("작성자 블로그에서 뒤로가면 읽던 글을 거쳐 목록으로 돌아갈 수 있다.", async () => {
    const wrapper = await render();
    await wrapper.findAll(".post-open")[1]!.trigger("click");
    await flushPromises();
    await wrapper
      .get('.article-meta [aria-label="다른 기록자의 블로그 보기"]')
      .trigger("click");
    await flushPromises();
    wrapper.vm.$router.back();
    await flushPromises();
    expect(wrapper.get(".article-body h2").text()).toBe("다른 사람의 글");
    wrapper.vm.$router.back();
    await flushPromises();
    expect(wrapper.find(".article-body").exists()).toBe(false);
    expect(wrapper.get("#content-panel-title").text()).toBe("Blog House");
  });

  it("창을 닫고 다시 열면 이전 방문 기록을 초기화할 수 있다.", async () => {
    user.value = userFixture("USER");
    const wrapper = await render();
    await wrapper.get('[aria-label="내 블로그 보기"]').trigger("click");
    await flushPromises();
    await wrapper.findAll(".post-open")[1]!.trigger("click");
    await flushPromises();
    await wrapper.get(".content-exit").trigger("click");
    await flushPromises();
    await wrapper
      .findAll(".site-header:not([inert]) nav > button")[0]!
      .trigger("click");
    await flushPromises();
    expect(wrapper.get("#content-panel-title").text()).toBe("Blog House");
    await wrapper.get('[aria-label="기록자의 블로그 보기"]').trigger("click");
    await flushPromises();
    wrapper.vm.$router.back();
    await flushPromises();
    expect(wrapper.find(".article-body").exists()).toBe(false);
    expect(wrapper.get("#content-panel-title").text()).toBe("Blog House");
  });
  it("내 블로그의 카테고리별 글 수를 유지하면서 검색하고 최신순으로 볼 수 있다.", async () => {
    user.value = userFixture("USER");
    const wrapper = await render();
    await wrapper.get('[aria-label="내 블로그 보기"]').trigger("click");
    await flushPromises();
    const categories = () =>
      wrapper.findAll(".blog-categories button").map((button) => button.text());
    expect(categories()).toEqual(["전체2", "개발 기록1", "프론트엔드1"]);
    expect(titles(wrapper)).toEqual(["나의 Vue 기록", "나의 비공개 글"]);
    await wrapper.findAll(".blog-categories button")[2]!.trigger("click");
    await flushPromises();
    expect(wrapper.vm.$router.currentRoute.value.query.category).toBe(
      "프론트엔드",
    );
    expect(titles(wrapper)).toEqual(["나의 비공개 글"]);
    await wrapper.get(".search-input input").setValue("typescript");
    await flushPromises();
    expect(titles(wrapper)).toEqual(["나의 비공개 글"]);
    expect(categories()).toEqual(["전체2", "개발 기록1", "프론트엔드1"]);
    await wrapper.get(".search-input input").setValue("없는 글");
    await flushPromises();
    expect(titles(wrapper)).toEqual([]);
    expect(categories()).toEqual(["전체2", "개발 기록1", "프론트엔드1"]);
    await wrapper.get(".clear-blog-search").trigger("click");
    await flushPromises();
    expect(titles(wrapper)).toEqual(["나의 비공개 글"]);
    await wrapper.findAll(".blog-categories button")[0]!.trigger("click");
    await flushPromises();
    expect(titles(wrapper)).toEqual(["나의 Vue 기록", "나의 비공개 글"]);
  });

  it("방문자에게 공개된 글만 카테고리별로 집계할 수 있다.", async () => {
    const wrapper = await render();
    await wrapper.vm.$router.push("/blog/기록자");
    await flushPromises();
    expect(
      wrapper.findAll(".blog-categories button").map((button) => button.text()),
    ).toEqual(["전체1", "개발 기록1"]);
    expect(titles(wrapper)).toEqual(["나의 Vue 기록"]);
    expect(wrapper.find(".post-sort").exists()).toBe(false);
  });

  it("주소로 카테고리와 검색어를 복원하고 글을 읽은 뒤 유지할 수 있다.", async () => {
    user.value = userFixture("USER");
    const wrapper = await render();
    await wrapper.vm.$router.push({
      name: "user-blog",
      params: { authorSlug: "기록자" },
      query: { category: "개발 기록", q: "vue", sort: "views" },
    });
    await flushPromises();
    expect(titles(wrapper)).toEqual(["나의 Vue 기록"]);
    expect(wrapper.get('.blog-categories [aria-current="true"]').text()).toBe(
      "개발 기록1",
    );
    await wrapper.get(".post-open").trigger("click");
    await flushPromises();
    wrapper.vm.$router.back();
    await flushPromises();
    expect(wrapper.vm.$router.currentRoute.value.query).toEqual({
      category: "개발 기록",
      q: "vue",
      sort: "views",
    });
    expect(
      (wrapper.get(".search-input input").element as HTMLInputElement).value,
    ).toBe("vue");
    expect(titles(wrapper)).toEqual(["나의 Vue 기록"]);
    await wrapper.vm.$router.replace({ query: { sort: "views" } });
    await flushPromises();
    expect(titles(wrapper)).toEqual(["나의 Vue 기록", "나의 비공개 글"]);
  });
  it("내 집에서 내 블로그와 비공개 글을 열고 집으로 돌아갈 수 있다.", async () => {
    user.value = userFixture("USER");
    const wrapper = await render();
    await wrapper.vm.$router.push({ name: "city", query: { view: "home" } });
    await flushPromises();
    expect(wrapper.get("#content-panel-title").text()).toBe("기록자의 집");
    expect(titles(wrapper)).toEqual(["나의 Vue 기록", "나의 비공개 글"]);
    await wrapper.get(".home-section-action button").trigger("click");
    await flushPromises();
    expect(wrapper.get("#content-panel-title").text()).toBe("기록자의 블로그");
    wrapper.vm.$router.back();
    await flushPromises();
    expect(wrapper.get("#content-panel-title").text()).toBe("기록자의 집");
    await wrapper.findAll(".post-open")[1]!.trigger("click");
    await flushPromises();
    expect(wrapper.get(".article-body h2").text()).toBe("나의 비공개 글");
    wrapper.vm.$router.back();
    await flushPromises();
    expect(wrapper.get("#content-panel-title").text()).toBe("기록자의 집");
  });
});
