import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createWebHistory, createRouter } from "vue-router";
import { RouterView } from "vue-router";
import { fetchPost, fetchPosts, fetchMyPostCount, updatePost, removePost } from "@/services/blog-api";
import { fetchPortfolio, removePortfolio } from "@/services/portfolio-api";
import { fetchNeighborhoodResidents } from "@/services/neighborhood";
import { rememberSavedPost, takeSavedPost } from "@/store/saved-post";
import { AuthError } from "@/services/auth-api";
import * as markdownLoader from "@/utils/blog/markdown-loader";
import { auth, type UserProfile } from "@/store/auth";
import { userFixture } from "./fixtures/auth";
import { cityRoutes } from "@/router/city-routes";
import { blogPostsFixture, postFixture } from "./fixtures/blog";
import { clearCityState, saveCityState, type CityState } from "@/store/city";
import { portfolios, type PortfolioItem } from "@/store/portfolio";
import { authorSlug } from "@/utils/blog/slug";

const originalPortfolios = JSON.stringify(portfolios.value);
function portfolioFixture(): PortfolioItem {
  return {
    id: 1, author: { id: 1, name: "기록자" }, title: "테스트 포트폴리오",
    summary: "테스트 소개", content: "테스트 본문", visibility: "PUBLIC",
  };
}

const setHome = vi.hoisted(() => vi.fn());
const cityLifecycle = vi.hoisted(() => ({
  create: vi.fn(), dispose: vi.fn(), restore: vi.fn(), reset: vi.fn(), state: vi.fn(),
}));
const savedCity: CityState = {
  position: { x: 12, z: 22 }, rotation: 1.2, district: -1,
  camera: { position: [75, 85, 110], target: [-9, 0, 1], zoom: 1.1 },
  suppressed: null, suppressedResidence: null,
};
const blogApiMock = vi.hoisted(() => ({
  posts: [] as import("@/utils/blog/posts").BlogPost[],
  userId: 1,
}));

vi.mock("@/services/blog-api", () => ({
  fetchPostPage: async ({ page, search, sort, tag }: { page: number; search?: string; sort?: string; tag?: string }) => {
    const { filterPosts } = await import("@/utils/blog/post-collection");
    const posts = filterPosts(blogApiMock.posts.filter((post) => post.visibility !== "PRIVATE"), {
      search: search ?? "", category: "", tag: tag ?? "", sort: sort === "LIKES" ? "likes" : "latest",
    });
    return { content: posts.slice(page * 12, (page + 1) * 12), page, totalPages: Math.ceil(posts.length / 12), totalElements: posts.length };
  },
  fetchPosts: vi.fn(async ({ mine }: { mine?: boolean } = {}) =>
    blogApiMock.posts.filter((post) =>
      mine
        ? post.author?.id === blogApiMock.userId
        : post.visibility !== "PRIVATE",
    )),
  fetchMyPostCount: vi.fn(async () => blogApiMock.posts.filter((post) => post.author?.id === blogApiMock.userId).length),
  fetchPost: vi.fn(async (id: number) =>
    blogApiMock.posts.find((post) => post.id === id)),
  updatePost: vi.fn(),
  removePost: vi.fn(),
}));
vi.mock("@/services/profile-api", () => ({
  fetchHomeProfile: vi.fn(async (nickname: string | number) => ({
    owner: { id: nickname === "기록자" || nickname === 1 ? 1 : 2, name: String(nickname), nickname: String(nickname) },
    email: "", github: "", profileImageUrl: null,
  })),
}));
vi.mock("@/services/portfolio-api", () => ({
  removePortfolio: vi.fn(async () => {}),
  fetchPortfolio: vi.fn(async (id: number) => {
    const item = portfolios.value.find((item) => item.id === id);
    if (!item || item.visibility === "PRIVATE" && item.author.id !== auth.user.value?.id) throw new Error("포트폴리오를 찾을 수 없어요.");
    return item;
  }),
  fetchPortfolioPage: vi.fn(async ({ mine, authorId, search, page = 0, size = 6 }: { mine?: boolean; authorId?: number; search?: string; page?: number; size?: number } = {}) => {
    const items = [...portfolios.value].filter((item) => (mine ? item.author.id === auth.user.value?.id : item.visibility === "PUBLIC" && (!authorId || item.author.id === authorId))
      && (!search || item.title.includes(search))).sort((a, b) => b.id - a.id);
    return { content: items.slice(page * size, (page + 1) * size), totalElements: items.length, totalPages: Math.ceil(items.length / size), page };
  }),
}));
vi.mock("@/store/auth", async () => {
  const { shallowRef } = await import("vue");
  return { auth: { user: shallowRef(null), restore: vi.fn(async () => true) } };
});
vi.mock("@/services/neighborhood", async (original) => ({
  ...await original<typeof import("@/services/neighborhood")>(),
  fetchNeighborhoodResidents: vi.fn(async () => [{
    id: 2, name: "다른 기록자", nickname: "다른 기록자", role: "USER",
    postCount: 1, level: 0, activity: 1, activityPoints: null,
  }]),
}));
vi.mock("@/utils/city/world", () => ({
  createCity: (...args: unknown[]) => {
    cityLifecycle.create(...args);
    return {
      getState: cityLifecycle.state,
      restoreState: cityLifecycle.restore,
      reset: cityLifecycle.reset,
      returnFromVisit: vi.fn(),
      setPaused: vi.fn(),
      setNight: vi.fn(),
      dispose: cityLifecycle.dispose,
      setInput: vi.fn(),
      setJoystick: vi.fn(),
      setRunning: vi.fn(),
      setHome,
      setNeighborhood: vi.fn(),
      goToDistrict: vi.fn(),
      visitResidence: vi.fn(),
    };
  },
}));

const user = auth.user as { value: UserProfile | null };
const wrappers: VueWrapper[] = [];
async function render(writer = false) {
  window.history.replaceState({}, "", "/");
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      ...cityRoutes,
      {
        path: "/write/:draftId?",
        name: "blog-write",
        component: writer ? () => import("@/views/WriteView.vue") : { template: "<div />" },
      },
    ],
  });
  await router.push("/blog");
  const wrapper = mount(RouterView, {
    attachTo: document.body,
    global: {
      plugins: [router],
      stubs: {
        AccountActions: true, PostComments: true, PostLikeButton: true,
        MarkdownEditor: { template: "<div />", methods: { scrollElement: () => undefined } },
      },
    },
  });
  wrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}
function titles(wrapper: VueWrapper) {
  return wrapper.findAll(".post-card h3").map((card) => card.text());
}
async function openMyBlog(wrapper: VueWrapper) {
  await wrapper.vm.$router.push({ name: "user-blog", params: { authorSlug: authorSlug(user.value!.name) } });
  await flushPromises();
}
async function searchFor(wrapper: VueWrapper, value: string) {
  await wrapper.get('input[aria-label="블로그 글 검색"]').setValue(value);
  await vi.waitFor(() => {
    expect(wrapper.vm.$router.currentRoute.value.query.q).toBe(value);
  });
  await flushPromises();
}

describe("블로그 글 목록", () => {
  beforeEach(() => {
    user.value = null;
    vi.clearAllMocks();
    takeSavedPost(undefined, undefined);
    setHome.mockClear();
    clearCityState();
    for (const mock of Object.values(cityLifecycle)) mock.mockReset();
    cityLifecycle.state.mockReturnValue(savedCity);
    blogApiMock.posts = blogPostsFixture();
    blogApiMock.userId = 1;
  });
  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => {
      wrapper.vm.$router.options.history.destroy();
      wrapper.unmount();
    });
    portfolios.value = JSON.parse(originalPortfolios);
  });

  it("선택하려는 글을 미리 불러오고 클릭할 때 진행 중인 요청을 재사용할 수 있다.", async () => {
    const post = postFixture({ content: "미리 요청한 본문" });
    blogApiMock.posts = [post];
    const wrapper = await render();
    const renderer = vi.spyOn(markdownLoader, "loadMarkdownContent");
    let resolve!: (post: ReturnType<typeof postFixture>) => void;
    vi.mocked(fetchPost).mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const link = wrapper.get(".post-open");
    await link.trigger("focus");
    await link.trigger("pointerdown");
    expect(fetchPost).toHaveBeenCalledExactlyOnceWith(post.id);
    expect(renderer).toHaveBeenCalled();
    expect(wrapper.find(".article-body").exists()).toBe(false);

    await link.trigger("click");
    await flushPromises();
    expect(fetchPost).toHaveBeenCalledTimes(1);
    resolve(post);
    await flushPromises();
    await vi.waitFor(() => expect(wrapper.get(".article-body").text()).toContain("미리 요청한 본문"));
  });

  it.each(["만료", "계정 변경"])("%s 후에는 이전에 준비한 본문을 재사용하지 않을 수 있다.", async (reason) => {
    blogApiMock.posts = [postFixture({ content: "이전 본문" })];
    const wrapper = await render();
    await wrapper.get(".post-open").trigger("focus");
    await flushPromises();
    if (reason === "만료") vi.spyOn(Date, "now").mockReturnValue(Date.now() + 31_000);
    else {
      user.value = userFixture("USER");
      await flushPromises();
    }
    vi.mocked(fetchPost).mockResolvedValueOnce(postFixture({ content: "새로 확인한 본문" }));
    await wrapper.get(".post-open").trigger("click");
    await flushPromises();
    expect(fetchPost).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(wrapper.get(".article-body").text()).toContain("새로 확인한 본문"));
    expect(wrapper.get(".article-body").text()).not.toContain("이전 본문");
  });

  it("미리 불러오기가 실패해도 목록을 유지하고 실제로 열 때 다시 조회할 수 있다.", async () => {
    blogApiMock.posts = [postFixture()];
    const wrapper = await render();
    vi.mocked(fetchPost).mockRejectedValueOnce(new AuthError(0, "NETWORK_ERROR", "network error"));
    await wrapper.get(".post-open").trigger("focus");
    await flushPromises();
    expect(wrapper.find(".blog-storage-error").exists()).toBe(false);
    vi.mocked(fetchPost).mockResolvedValueOnce(postFixture({ content: "다시 조회한 본문" }));
    await wrapper.get(".post-open").trigger("click");
    await flushPromises();
    expect(fetchPost).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(wrapper.get(".article-body").text()).toContain("다시 조회한 본문"));
  });

  it("비공개 글은 미리 조회하지 않고 실제로 열 때 조회할 수 있다.", async () => {
    user.value = userFixture("USER");
    blogApiMock.posts = [postFixture({ visibility: "PRIVATE", content: "비공개 본문" })];
    const wrapper = await render();
    await wrapper.vm.$router.push("/blog/기록자");
    await flushPromises();
    await wrapper.get(".post-open").trigger("focus");
    expect(fetchPost).not.toHaveBeenCalled();
    await wrapper.get(".post-open").trigger("click");
    await flushPromises();
    expect(fetchPost).toHaveBeenCalledExactlyOnceWith(1);
    await vi.waitFor(() => expect(wrapper.get(".article-body").text()).toContain("비공개 본문"));
  });

  it("작성·미리보기 구분선을 드래그하거나 키보드로 조절하고 반반으로 복원할 수 있다.", async () => {
    user.value = userFixture("USER");
    const wrapper = await render(true);
    await wrapper.vm.$router.push("/write");
    await flushPromises();
    await vi.waitFor(() => expect(wrapper.find('[role="separator"]').exists()).toBe(true));
    const divider = wrapper.get('[role="separator"]');
    const layout = wrapper.get(".writer-layout");
    vi.spyOn(layout.element, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 0, 1000, 600));
    Object.defineProperties(layout.element, { clientWidth: { value: 1000 }, clientLeft: { value: 0 } });
    vi.spyOn(divider.element, "getBoundingClientRect").mockReturnValue(new DOMRect(594, 0, 12, 600));
    const release = vi.fn();
    Object.defineProperties(divider.element, {
      setPointerCapture: { value: vi.fn() }, hasPointerCapture: { value: () => true }, releasePointerCapture: { value: release },
    });
    await divider.trigger("pointerdown", { button: 0, pointerId: 1, isPrimary: true });
    await divider.trigger("pointermove", { pointerId: 1, clientX: 850 });
    expect(divider.attributes("aria-valuenow")).toBe("75");
    await divider.trigger("pointermove", { pointerId: 1, clientX: 2000 });
    expect(divider.attributes("aria-valuenow")).toBe("80");
    await divider.trigger("pointerup", { pointerId: 1 });
    expect(release).toHaveBeenCalledWith(1);
    await divider.trigger("pointermove", { pointerId: 1, clientX: 100 });
    expect(divider.attributes("aria-valuenow")).toBe("80");
    await divider.trigger("keydown", { key: "Home" });
    await divider.trigger("keydown", { key: "ArrowRight" });
    expect(divider.attributes("aria-valuenow")).toBe("22");
    await divider.trigger("dblclick");
    expect(divider.attributes("aria-valuenow")).toBe("50");
    await wrapper.get('[aria-label="미리보기"]').trigger("click");
    expect(wrapper.find('[role="separator"]').exists()).toBe(false);
    await wrapper.get('[aria-label="작성"]').trigger("click");
    expect(wrapper.get('[role="separator"]').attributes("aria-valuenow")).toBe("50");
    expect(wrapper.get<HTMLTextAreaElement>('[aria-label="게시글 제목"]').element.value).toBe("");
  });

  it.each([null, 2, 1])("사용자 %s에게 소유한 글의 관리 기능만 표시하고 삭제를 취소할 수 있다.", async (id) => {
    user.value = id ? { ...userFixture("USER"), id } : null;
    blogApiMock.posts = [postFixture({ content: "본문" })];
    const wrapper = await render();
    await wrapper.get(".post-open").trigger("click");
    await flushPromises();
    const edit = wrapper.find('[aria-label="게시글 수정"]');
    const remove = wrapper.find('[aria-label="게시글 삭제"]');
    expect(edit.exists()).toBe(id === 1);
    expect(remove.exists()).toBe(id === 1);
    expect(wrapper.find(".content-window > .content-actions").exists()).toBe(false);
    expect(wrapper.find(".article-header-actions").exists()).toBe(true);
    if (id !== 1) return;
    await remove.trigger("click");
    await flushPromises();
    expect(wrapper.get("dialog").attributes("open")).toBeDefined();
    expect(wrapper.get("dialog").attributes("aria-modal")).toBe("true");
    expect(wrapper.get<HTMLButtonElement>(".post-delete-submit").element.disabled).toBe(true);
    await wrapper.get("#post-delete-input").setValue("삭제해");
    expect(wrapper.get<HTMLButtonElement>(".post-delete-submit").element.disabled).toBe(true);
    await wrapper.get("#post-delete-input").setValue("삭제");
    expect(wrapper.get<HTMLButtonElement>(".post-delete-submit").element.disabled).toBe(false);
    await wrapper.get(".post-delete-cancel").trigger("click");
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(removePost).not.toHaveBeenCalled();
  });

  it.each([null, 2, 1])("사용자 %s에게 소유한 포트폴리오만 관리하도록 하고 문구를 확인한 뒤 삭제한다.", async (id) => {
    user.value = id ? { ...userFixture("USER"), id } : null;
    portfolios.value = [portfolioFixture()];
    const wrapper = await render();
    await wrapper.vm.$router.push({ name: "portfolio", query: { portfolioId: "1" } });
    await vi.waitFor(() => expect(wrapper.find(".portfolio-document-title").exists()).toBe(true));
    expect(wrapper.find(".portfolio-document-actions").exists()).toBe(true);
    expect(wrapper.find(".portfolio-list-heading").exists()).toBe(false);
    expect(wrapper.find('[aria-label="포트폴리오 수정"]').exists()).toBe(id === 1);
    expect(wrapper.find('[aria-label="PDF 내보내기"]').exists()).toBe(id === 1);
    const remove = wrapper.find('[aria-label="포트폴리오 삭제"]');
    expect(remove.exists()).toBe(id === 1);
    if (id !== 1) return;
    await remove.trigger("click");
    await flushPromises();
    expect(wrapper.get("dialog").attributes("open")).toBeDefined();
    expect(wrapper.get("dialog h2").text()).toBe("포트폴리오를 삭제할까요?");
    await wrapper.get("#post-delete-input").setValue("삭제해");
    await wrapper.get(".post-delete-submit").trigger("click");
    expect(portfolios.value.some((item) => item.id === 1)).toBe(true);
    await wrapper.get(".post-delete-cancel").trigger("click");
    await remove.trigger("click");
    await flushPromises();
    expect(wrapper.get<HTMLInputElement>("#post-delete-input").element.value).toBe("");
    await wrapper.get("#post-delete-input").setValue("삭제");
    await wrapper.get(".post-delete-submit").trigger("click");
    await flushPromises();
    expect(removePortfolio).toHaveBeenCalledExactlyOnceWith(1);
    expect(portfolios.value.some((item) => item.id === 1)).toBe(false);
    expect(wrapper.find("dialog").exists()).toBe(false);
    expect(wrapper.vm.$router.currentRoute.value.params.portfolioId).toBeUndefined();
  });

  it("삭제 실패 시 확인창과 문서를 유지하고 서버 성공 후에만 목록으로 이동한다", async () => {
    user.value = userFixture("USER");
    portfolios.value = [portfolioFixture()];
    const wrapper = await render();
    await wrapper.vm.$router.push({ name: "portfolio", query: { portfolioId: "1" } });
    await vi.waitFor(() => expect(wrapper.find('[aria-label="포트폴리오 삭제"]').exists()).toBe(true));
    await wrapper.get('[aria-label="포트폴리오 삭제"]').trigger("click");
    await flushPromises();
    await wrapper.get("#post-delete-input").setValue("삭제");
    vi.mocked(removePortfolio).mockRejectedValueOnce(new Error("삭제 실패"));
    await wrapper.get(".post-delete-submit").trigger("click");
    await flushPromises();
    expect(wrapper.get("dialog").text()).toContain("삭제 실패");
    expect(portfolios.value).toHaveLength(1);
    expect(wrapper.vm.$router.currentRoute.value.params.portfolioId).toBe("1");
    let finish!: () => void;
    vi.mocked(removePortfolio).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await wrapper.get(".post-delete-submit").trigger("click");
    expect(wrapper.get<HTMLButtonElement>(".post-delete-submit").element.disabled).toBe(true);
    expect(portfolios.value).toHaveLength(1);
    finish();
    await flushPromises();
    expect(portfolios.value).toHaveLength(0);
    expect(wrapper.vm.$router.currentRoute.value.params.portfolioId).toBeUndefined();
  });

  it("내 집과 이웃집을 닉네임 주소로 열고 탭을 누르기 전에도 공개 범위에 맞는 포트폴리오 수를 표시한다", async () => {
    const sample = portfolioFixture();
    portfolios.value = [sample, { ...sample, id: 2, visibility: "PRIVATE" },
      { ...sample, id: 3, author: { id: 2, name: "이웃" } },
      { ...sample, id: 4, author: { id: 2, name: "이웃" }, visibility: "PRIVATE" }];
    user.value = { ...userFixture("USER"), nickname: "기록자" };
    const wrapper = await render();
    await wrapper.vm.$router.push("/기록자");
    await vi.waitFor(() => expect(wrapper.get("#home-tab-portfolio").text()).toBe("내 포트폴리오2"));
    expect(wrapper.vm.$router.currentRoute.value.name).toBe("user-profile");
    expect(wrapper.get("#home-tab-blog").attributes("aria-selected")).toBe("true");
    await wrapper.vm.$router.push("/이웃");
    await vi.waitFor(() => expect(wrapper.get("#home-tab-portfolio").text()).toBe("포트폴리오1"));
    await wrapper.get("#home-tab-portfolio").trigger("click");
    await vi.waitFor(() => expect(wrapper.findAll(".portfolio-entry")).toHaveLength(1));
    expect(wrapper.find(".home-write").exists()).toBe(false);
  });

  it("상세의 전체 화면 링크로 이동하면 상단 바 없이 보기 주소를 유지한다", async () => {
    portfolios.value = [portfolioFixture()];
    const wrapper = await render();
    await wrapper.vm.$router.push({ name: "portfolio", query: { portfolioId: "1" } });
    await vi.waitFor(() => expect(wrapper.find('[aria-label="전체 화면 보기"]').exists()).toBe(true));
    await wrapper.get('[aria-label="전체 화면 보기"]').trigger("click");
    await vi.waitFor(() => expect(wrapper.find(".portfolio-presentation").exists()).toBe(true));
    expect(wrapper.vm.$router.currentRoute.value.name).toBe("portfolio-view");
    expect(wrapper.vm.$router.currentRoute.value.path).toMatch(/\/1\/view$/);
    expect(wrapper.find(".site-header").exists()).toBe(false);
  });

  it("캐시 없이 상세를 복원하고 늦게 도착한 이전 문서 응답을 무시한다.", async () => {
    portfolios.value = [];
    let finish!: (item: PortfolioItem) => void;
    vi.mocked(fetchPortfolio).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const wrapper = await render();
    await wrapper.vm.$router.push({ name: "portfolio", query: { portfolioId: "1" } });
    await vi.waitFor(() => expect(fetchPortfolio).toHaveBeenCalledWith(1));
    expect(wrapper.find(".content-empty, .portfolio-list-heading").exists()).toBe(false);
    vi.mocked(fetchPortfolio).mockResolvedValueOnce({ ...portfolioFixture(), id: 2, title: "최신 문서" });
    await wrapper.vm.$router.push({ query: { portfolioId: "2" } });
    await vi.waitFor(() => expect(wrapper.find(".portfolio-document-title").text()).toBe("최신 문서"));
    finish(portfolioFixture());
    await flushPromises();
    expect(wrapper.get(".portfolio-document-title").text()).toBe("최신 문서");
  });

  it("포트폴리오를 이미지와 홈 버튼 없이 최신순으로 페이지를 나누고 검색한다.", async () => {
    user.value = userFixture("USER");
    const sample = portfolioFixture();
    portfolios.value = Array.from({ length: 14 }, (_, index) => ({
      ...sample, id: index + 1, title: `작업 ${index + 1}`,
      summary: `작업 ${index + 1} 소개`, coverImage: "https://example.com/cover.png",
      visibility: index === 13 ? "PRIVATE" : "PUBLIC",
    }));
    const wrapper = await render();
    await wrapper.vm.$router.push({ name: "portfolio" });
    await flushPromises();
    const listed = () => wrapper.findAll(".portfolio-entry h3").map((item) => item.text());
    await vi.waitFor(() => expect(listed()).toEqual(["작업 13", "작업 12", "작업 11", "작업 10", "작업 9", "작업 8"]));
    expect(wrapper.find(".portfolio-feed img, .project-art").exists()).toBe(false);
    expect(wrapper.get("main").text()).not.toContain("최신순");
    await wrapper.get('[aria-label="포트폴리오 페이지"] [aria-label="2페이지"]').trigger("click");
    await vi.waitFor(() => expect(listed()).toEqual(["작업 7", "작업 6", "작업 5", "작업 4", "작업 3", "작업 2"]));
    await wrapper.get('[aria-label="포트폴리오 검색"]').setValue("작업 1");
    await vi.waitFor(() => expect(listed()).toEqual(["작업 13", "작업 12", "작업 11", "작업 10", "작업 1"]));
  });

  it("수정 응답으로 새 제목과 본문을 재조회 없이 바로 표시할 수 있다.", async () => {
    user.value = userFixture("USER");
    blogApiMock.posts = [postFixture({ content: "수정 전 본문", likedByMe: true })];
    const wrapper = await render(true);
    await wrapper.get(".post-open").trigger("click");
    await flushPromises();
    await wrapper.get('[aria-label="게시글 수정"]').trigger("click");
    await flushPromises();
    await vi.waitFor(() => expect(wrapper.find('[aria-label="게시글 제목"]').exists()).toBe(true));
    await wrapper.get('[aria-label="게시글 제목"]').setValue("바뀐 제목");
    vi.mocked(updatePost).mockResolvedValue(postFixture({
      title: "바뀐 제목", content: "서버에서 저장한 본문", likeCount: 0, likedByMe: false,
    }));
    vi.clearAllMocks();

    await wrapper.get(".writer-publish").trigger("click");
    await vi.waitFor(() => expect(wrapper.find(".article-body").exists()).toBe(true));

    expect(wrapper.get(".article-body h2").text()).toBe("바뀐 제목");
    expect(wrapper.get(".article-body").text()).toContain("서버에서 저장한 본문");
    expect(wrapper.vm.$router.currentRoute.value.params.postSlug).toBe("바뀐-제목");
    expect(wrapper.vm.$router.currentRoute.value.params.postId).toBe("1");
    expect(updatePost).toHaveBeenCalledOnce();
    expect(fetchPost).not.toHaveBeenCalled();
    expect(fetchPosts).not.toHaveBeenCalled();
    expect(fetchNeighborhoodResidents).not.toHaveBeenCalled();
    expect(fetchMyPostCount).not.toHaveBeenCalled();
    expect(wrapper.get("post-like-button-stub").attributes("likecount")).toBe("10");
    expect(wrapper.get("post-like-button-stub").attributes("likedbyme")).toBe("true");
  });

  it("새 글 저장 응답을 표시하고 다시 방문할 때는 본문만 조회할 수 있다.", async () => {
    user.value = userFixture("USER");
    const wrapper = await render();
    const post = postFixture({ id: 99, title: "새 글", content: "새 본문" });
    await wrapper.vm.$router.push("/write");
    rememberSavedPost(post);
    const target = { name: "blog-post", params: { authorSlug: "기록자", postSlug: "새-글", postId: "99" }, state: { postId: 99 } };
    vi.clearAllMocks();
    await wrapper.vm.$router.replace(target);
    await flushPromises();
    expect(wrapper.get(".article-body").text()).toContain("새 본문");
    expect(fetchPosts).not.toHaveBeenCalled();
    expect(fetchPost).not.toHaveBeenCalled();
    await wrapper.vm.$router.push("/write");
    vi.mocked(fetchPost).mockResolvedValueOnce({ ...post, content: "최신 본문" });
    await wrapper.vm.$router.push(target);
    await flushPromises();
    expect(fetchPost).toHaveBeenCalledExactlyOnceWith(99);
    expect(fetchPosts).not.toHaveBeenCalled();
    expect(wrapper.get(".article-body").text()).toContain("최신 본문");
  });

  it("제목이 같은 글도 URL의 글 ID로 구분해 열 수 있다.", async () => {
    const first = postFixture({ id: 11, title: "같은 제목", content: "첫 번째 본문" });
    const second = postFixture({ id: 12, title: "같은 제목", content: "두 번째 본문" });
    blogApiMock.posts = [first, second];
    const wrapper = await render();
    const links = wrapper.findAll(".post-open");
    expect(links[0]!.attributes("href")).not.toBe(links[1]!.attributes("href"));

    const secondLink = links.find((link) => link.attributes("href")?.endsWith("/12"));
    expect(secondLink).toBeDefined();
    await secondLink!.trigger("click");
    await flushPromises();

    expect(wrapper.vm.$router.currentRoute.value.path).toMatch(/\/12$/);
    expect(wrapper.get(".article-body").text()).toContain("두 번째 본문");
    expect(fetchPost).toHaveBeenCalledWith(12);
  });

  it("본문을 조회하는 동안 오류를 표시하지 않고 삭제된 글을 다시 보여주지 않을 수 있다.", async () => {
    const wrapper = await render();
    let reject!: (reason: unknown) => void;
    vi.mocked(fetchPost).mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
    await wrapper.get(".post-open").trigger("click");
    await flushPromises();
    expect(wrapper.find(".blog-empty-state, .blog-storage-error, .article-body").exists()).toBe(false);
    reject(new AuthError(404, "POST_NOT_FOUND", "not found"));
    await flushPromises();
    expect(wrapper.find(".article-body").exists()).toBe(false);
    expect(wrapper.get(".blog-empty-state").text()).toContain("글을 찾을 수 없어요");
  });

  it("계정이 달라지면 저장 응답의 비공개 본문을 재사용하지 않을 수 있다.", async () => {
    const post = postFixture({ content: "비공개 본문", visibility: "PRIVATE" });
    rememberSavedPost(post);
    expect(takeSavedPost(post.id, 2)).toBeUndefined();
    expect(takeSavedPost(post.id, 1)).toBeUndefined();
  });

  it("페이지로 이동할 때 지도를 정리하고 뒤로가면 위치와 카메라를 복원할 수 있다.", async () => {
    const wrapper = await render();
    await wrapper.vm.$router.push("/");
    await flushPromises();
    expect(cityLifecycle.create).toHaveBeenCalledOnce();
    expect(wrapper.find("canvas").exists()).toBe(true);
    await wrapper.get(".site-header nav > button").trigger("click");
    await flushPromises();
    expect(cityLifecycle.dispose).toHaveBeenCalledOnce();
    expect(wrapper.find("canvas").exists()).toBe(false);
    wrapper.vm.$router.back();
    await flushPromises();
    expect(cityLifecycle.create).toHaveBeenCalledTimes(2);
    expect(cityLifecycle.restore).toHaveBeenLastCalledWith(savedCity);
    await wrapper.vm.$router.push("/news");
    await flushPromises();
    expect(cityLifecycle.dispose).toHaveBeenCalledTimes(2);
  });

  it("저장한 이웃 지도를 복원하고 로고를 누르면 초기 지도로 돌아갈 수 있다.", async () => {
    const wrapper = await render();
    const state = { ...savedCity, position: { x: 160, z: 12 }, district: 0 };
    saveCityState(state);
    await wrapper.vm.$router.push("/");
    await flushPromises();
    expect(cityLifecycle.restore).toHaveBeenLastCalledWith(state);
    await wrapper.get('[aria-label="Codeiary 홈으로"]').trigger("click");
    await flushPromises();
    expect(cityLifecycle.reset).toHaveBeenCalledOnce();
    await wrapper.vm.$router.push("/portfolio");
    await flushPromises();
    cityLifecycle.restore.mockClear();
    await wrapper.get('[aria-label="Codeiary 홈으로"]').trigger("click");
    await flushPromises();
    expect(cityLifecycle.restore).not.toHaveBeenCalled();
    expect(wrapper.find("canvas").exists()).toBe(true);
  });

  it("지도를 다녀온 뒤 블로그 목록의 스크롤 위치를 복원할 수 있다.", async () => {
    const wrapper = await render();
    const list = wrapper.get(".window-body");
    list.element.scrollTop = 320;
    await list.trigger("scroll");
    await wrapper.vm.$router.push("/");
    await flushPromises();
    wrapper.vm.$router.back();
    await flushPromises();
    const restoredList = wrapper.get(".window-body").element;
    Object.defineProperties(restoredList, {
      scrollHeight: { value: 1200, configurable: true },
      clientHeight: { value: 400, configurable: true },
    });
    await vi.waitFor(() => expect(restoredList.scrollTop).toBe(320));
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
    await openMyBlog(wrapper);
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
    await openMyBlog(wrapper);
    await flushPromises();
    user.value = { ...userFixture("USER"), id: 2 };
    blogApiMock.userId = 2;
    await flushPromises();
    expect(wrapper.get("#content-panel-title").text()).toBe("Blog House");
    await openMyBlog(wrapper);
    await flushPromises();
    expect(titles(wrapper)).toEqual([
      "다른 사람의 글",
      "다른 사람의 비공개 글",
    ]);
  });

  it("전체 글을 인기순으로 정렬하고 좋아요 수가 같으면 최신 글부터 볼 수 있다.", async () => {
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
  it("내 블로그의 카테고리별 글 수를 유지하면서 검색하고 최신순으로 볼 수 있다.", async () => {
    user.value = userFixture("USER");
    const wrapper = await render();
    await openMyBlog(wrapper);
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
    await searchFor(wrapper, "typescript");
    expect(titles(wrapper)).toEqual(["나의 비공개 글"]);
    expect(categories()).toEqual(["전체2", "개발 기록1", "프론트엔드1"]);
    await searchFor(wrapper, "없는 글");
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
      query: { category: "개발 기록", q: "vue", sort: "likes" },
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
      sort: "likes",
    });
    expect(
      (wrapper.get(".search-input input").element as HTMLInputElement).value,
    ).toBe("vue");
    expect(titles(wrapper)).toEqual(["나의 Vue 기록"]);
    await wrapper.vm.$router.replace({ query: { sort: "likes" } });
    await flushPromises();
    expect(titles(wrapper)).toEqual(["나의 Vue 기록", "나의 비공개 글"]);
  });
  it("마이페이지에서 포트폴리오를 검색하고 상세에서 돌아와도 선택한 탭과 페이지를 유지한다.", async () => {
    user.value = userFixture("USER");
    const sample = portfolioFixture();
    portfolios.value = [
      ...Array.from({ length: 12 }, (_, index) => ({ ...sample, id: index + 1, title: `작업 ${index + 1}`, visibility: index === 11 ? "PRIVATE" as const : "PUBLIC" as const })),
      { ...sample, id: 13, author: { id: 2, name: "다른 사람" }, title: "다른 사람의 비공개 포트폴리오", visibility: "PRIVATE" },
    ];
    const wrapper = await render();
    await wrapper.vm.$router.push({ name: "user-home", query: { tab: "portfolio" } });
    await flushPromises();
    const listed = () => wrapper.findAll(".portfolio-entry h3").map((item) => item.text());
    expect(wrapper.get("#content-panel-title").text()).toBe("마이페이지");
    await vi.waitFor(() => expect(listed()).toEqual(["작업 12", "작업 11", "작업 10", "작업 9", "작업 8", "작업 7", "작업 6", "작업 5"]));
    expect(wrapper.get("#home-tab-portfolio").text()).toContain("12");
    expect(wrapper.find("#home-profile-editor").exists()).toBe(false);
    await wrapper.get('[aria-label="마이페이지 포트폴리오 페이지"] [aria-label="2페이지"]').trigger("click");
    await flushPromises();
    expect(wrapper.vm.$router.currentRoute.value.query).toEqual({ tab: "portfolio", page: "2" });
    await vi.waitFor(() => expect(listed()).toEqual(["작업 4", "작업 3", "작업 2", "작업 1"]));
    await wrapper.get(".portfolio-entry").trigger("click");
    await flushPromises();
    expect(wrapper.vm.$router.currentRoute.value.name).toBe("portfolio-detail");
    expect(wrapper.vm.$router.currentRoute.value.params.portfolioId).toBe("4");
    wrapper.vm.$router.back();
    await flushPromises();
    expect(wrapper.get("#home-tab-portfolio").attributes("aria-selected")).toBe("true");
    await vi.waitFor(() => expect(listed()).toEqual(["작업 4", "작업 3", "작업 2", "작업 1"]));
    await wrapper.get('[aria-label="마이페이지 포트폴리오 검색"]').setValue("작업 1");
    await vi.waitFor(() => expect(listed()).toEqual(["작업 12", "작업 11", "작업 10", "작업 1"]));
    expect(wrapper.vm.$router.currentRoute.value.query.page).toBeUndefined();
    await wrapper.get("#home-tab-blog").trigger("click");
    await flushPromises();
    expect(wrapper.vm.$router.currentRoute.value.query).toEqual({});
    expect(titles(wrapper)).toEqual(["나의 Vue 기록", "나의 비공개 글"]);
    await wrapper.findAll(".blog-categories button").find((button) => button.text().includes("프론트엔드"))!.trigger("click");
    await flushPromises();
    expect(titles(wrapper)).toEqual(["나의 비공개 글"]);
    expect(wrapper.vm.$router.currentRoute.value.query.category).toBe("프론트엔드");
    expect(wrapper.get(".blog-categories button").text()).toContain("2");
    await wrapper.get(".post-open").trigger("click");
    await flushPromises();
    wrapper.vm.$router.back();
    await flushPromises();
    expect(wrapper.vm.$router.currentRoute.value.query.category).toBe("프론트엔드");
    expect(titles(wrapper)).toEqual(["나의 비공개 글"]);
    await wrapper.get(".home-write").trigger("click");
    await flushPromises();
    expect(wrapper.vm.$router.currentRoute.value.name).toBe("blog-write");
  });
});
