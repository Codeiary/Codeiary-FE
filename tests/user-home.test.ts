import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import UserHome from "@/components/profile/UserHome.vue";
import { auth, AuthError, type UserProfile } from "@/store/auth";
import { createHomeProfile, homeBlogPosts, type HomeProfile } from "@/utils/profile/home-profile";
import { prepareAvatar } from "@/utils/profile/avatar-upload";
import { deferred, userFixture } from "./fixtures/auth";
import { blogPostsFixture, postFixture } from "./fixtures/blog";

vi.mock("@/store/auth", async (original) => {
  const module = await original<typeof import("@/store/auth")>();
  const { shallowRef } = await import("vue");
  return {
    ...module,
    auth: {
      ...module.auth,
      user: shallowRef(null),
      checkNickname: vi.fn(),
      uploadProfileImage: vi.fn(),
      updateProfile: vi.fn(),
    },
  };
});
vi.mock("@/utils/profile/avatar-upload", () => ({ prepareAvatar: vi.fn() }));

const account = auth.user as { value: UserProfile | null };
const wrappers: VueWrapper[] = [];
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  account.value = null;
  vi.mocked(auth.checkNickname).mockReset().mockResolvedValue({ available: true });
  vi.mocked(auth.uploadProfileImage).mockReset().mockResolvedValue({ profileImageUrl: "https://images.example.com/uploaded.jpg" });
  vi.mocked(auth.updateProfile).mockReset();
  vi.mocked(prepareAvatar).mockReset().mockResolvedValue(new File(["jpeg"], "profile.jpg", { type: "image/jpeg" }));
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:profile-preview");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
});
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.useRealTimers();
});
function render(user = userFixture("USER"), own = true, profileOverride?: HomeProfile) {
  const profile = profileOverride ?? createHomeProfile(user);
  const wrapper = mount(UserHome, {
    props: {
      profile,
      posts: homeBlogPosts(blogPostsFixture(), profile.owner, user.id),
      own,
    },
    attachTo: document.body,
  });
  wrappers.push(wrapper);
  return wrapper;
}
async function selectPhoto(wrapper: VueWrapper, file = new File(["photo"], "photo.png", { type: "image/png" })) {
  const input = wrapper.get('input[type="file"]');
  Object.defineProperty(input.element, "files", { configurable: true, value: [file] });
  await input.trigger("change");
  return file;
}

describe("사용자의 집", () => {
  it("사용자 이름 대신 닉네임을 집과 블로그 이동에 사용할 수 있다.", async () => {
    const wrapper = render();
    const profile = createHomeProfile({
      ...userFixture(),
      nickname: "커밋여행자",
    });
    await wrapper.setProps({ profile });
    expect(wrapper.get(".home-profile h3").text()).toBe("커밋여행자");
    await wrapper.get(".home-section-action button").trigger("click");
    expect(wrapper.emitted("blog")).toHaveLength(1);
    expect(profile.owner.nickname).toBe("커밋여행자");
  });

  it("사용자가 공개한 연락 이메일과 GitHub 링크만 표시할 수 있다.", () => {
    const wrapper = render({
      ...userFixture("USER"),
      contactEmail: "contact@example.com",
      githubUrl: "https://github.com/writer",
    });
    expect(wrapper.get(".home-profile h3").text()).toBe(
      userFixture("USER").name,
    );
    expect(wrapper.get('a[href^="mailto:"]').attributes("href")).toBe(
      "mailto:contact@example.com",
    );
    expect(
      wrapper.get('a[href^="https://github.com/"]').attributes("rel"),
    ).toContain("noopener");
    expect(wrapper.get(".home-profile").text()).not.toContain("ADMIN");
    expect(wrapper.get(".home-profile").text()).not.toContain(userFixture().email);
  });
  it("공개 연락처가 없으면 로그인 이메일이나 기본 GitHub를 노출하지 않을 수 있다.", () => {
    const wrapper = render();
    expect(wrapper.find('a[href^="mailto:"]').exists()).toBe(false);
    expect(wrapper.find('a[href^="https://github.com/"]').exists()).toBe(false);
    expect(createHomeProfile(userFixture()).email).toBe("");
    expect(createHomeProfile(userFixture()).github).toBe("");
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
    const profile = createHomeProfile(userFixture("USER"));
    profile.projects = [{
      id: "codeiary",
      title: "Codeiary",
      category: "Web",
      date: "2026.10.06",
      description: "블로그 웹사이트",
      tags: ["Vue"],
      paragraphs: ["프로젝트 설명"],
    }];
    profile.issues = [{
      id: "browser-rendering",
      title: "3D 웹의 렌더링은 어디에서 일어날까?",
      category: "Web Graphics",
      date: "2026.10.05",
      description: "브라우저 렌더링",
      tags: ["WebGL"],
      paragraphs: ["렌더링 설명"],
    }];
    const wrapper = render(userFixture("USER"), true, profile);
    await wrapper.get("#home-tab-portfolio").trigger("click");
    expect(wrapper.findAll(".home-entry")).toHaveLength(1);
    await wrapper.findAll(".home-entry")[0]!.trigger("click");
    expect(wrapper.get(".home-entry-detail h3").text()).toBe("Codeiary");
    await wrapper.get(".home-detail-back").trigger("click");
    expect(wrapper.findAll(".home-entry")).toHaveLength(1);
    await wrapper.get("#home-tab-issues").trigger("click");
    await wrapper.findAll(".home-entry")[0]!.trigger("click");
    expect(wrapper.get(".home-entry-detail h3").text()).toContain("3D 웹");
  });
  it("키보드로 탭을 이동하고 계정이 바뀌면 이전 상세를 닫을 수 있다.", async () => {
    const profile = createHomeProfile(userFixture("USER"));
    profile.issues = [{ id: "one", title: "Issue", category: "IT", date: "2026.10.01", description: "", tags: [], paragraphs: [] }];
    const wrapper = render(userFixture("USER"), true, profile);
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
    const next = createHomeProfile({
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
  it("온보딩을 마친 소유자에게만 프로필 편집을 허용할 수 있다.", async () => {
    const owner = { ...userFixture("USER"), nickname: "기록자" };
    const wrapper = render(owner);
    expect(wrapper.find(".home-edit-profile").exists()).toBe(false);
    account.value = { ...owner, id: 2 };
    await flushPromises();
    expect(wrapper.find(".home-edit-profile").exists()).toBe(false);
    account.value = { ...owner, role: "PENDING" };
    await flushPromises();
    expect(wrapper.find(".home-edit-profile").exists()).toBe(false);
    account.value = owner;
    await wrapper.setProps({ own: false });
    expect(wrapper.find(".home-edit-profile").exists()).toBe(false);
    await wrapper.setProps({ own: true });
    await wrapper.get(".home-edit-profile").trigger("click");
    expect(wrapper.find("#home-profile-editor").exists()).toBe(true);
    account.value = { ...owner, id: 2 };
    await flushPromises();
    expect(wrapper.find("#home-profile-editor").exists()).toBe(false);
  });
  it.each([false, true])("새 사진 없이 기존 사진의 삭제 여부(%s)를 반영할 수 있다.", async (remove) => {
    account.value = {
      ...userFixture("USER"),
      nickname: "기록자",
      profileImageUrl: "https://images.example.com/old.png",
      contactEmail: "contact@example.com",
    };
    vi.mocked(auth.updateProfile).mockResolvedValue();
    const wrapper = render(account.value);
    await wrapper.get(".home-edit-profile").trigger("click");
    expect(wrapper.find("#profile-image-url").exists()).toBe(false);
    expect(wrapper.get('input[type="file"]').attributes("accept")).toContain("image/jpeg");
    expect(wrapper.get("#profile-nickname-help").text()).toContain("현재 닉네임");
    if (remove) await wrapper.get(".profile-photo-remove").trigger("click");
    await wrapper.get("#profile-github-url").setValue("https://github.com/new-writer");
    await wrapper.get("#profile-contact-email").setValue("");
    await wrapper.get("#home-profile-editor").trigger("submit");
    await flushPromises();
    expect(auth.updateProfile).toHaveBeenCalledWith({
      nickname: "기록자",
      profileImageUrl: remove ? null : "https://images.example.com/old.png",
      githubUrl: "https://github.com/new-writer",
      contactEmail: null,
    });
    expect(auth.uploadProfileImage).not.toHaveBeenCalled();
    expect(auth.checkNickname).not.toHaveBeenCalled();
    expect(wrapper.find("#home-profile-editor").exists()).toBe(false);
    expect(wrapper.get('[role="status"]').text()).toBe("프로필을 저장했어요.");
  });
  it("선택한 사진을 미리 보고 편집을 취소하면 임시 주소를 해제할 수 있다.", async () => {
    account.value = { ...userFixture("USER"), nickname: "기록자" };
    const wrapper = render(account.value);
    await wrapper.get(".home-edit-profile").trigger("click");
    const selected = await selectPhoto(wrapper);
    await flushPromises();
    expect(prepareAvatar).toHaveBeenCalledWith(selected);
    expect(wrapper.get(".profile-photo-preview img").attributes("src")).toBe("blob:profile-preview");
    await wrapper.get("#profile-nickname").setValue("수정중");
    await wrapper.get(".profile-cancel").trigger("click");
    expect(auth.updateProfile).not.toHaveBeenCalled();
    expect(auth.uploadProfileImage).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:profile-preview");
    expect(wrapper.find("#home-profile-editor").exists()).toBe(false);
    expect(wrapper.get(".home-profile h3").text()).toBe("기록자");
  });
  it("사진 처리와 업로드를 마친 뒤 저장하고 닉네임 충돌 재시도에는 업로드를 반복하지 않을 수 있다.", async () => {
    account.value = { ...userFixture("USER"), nickname: "기록자" };
    const prepared = deferred<File>();
    const uploaded = deferred<{ profileImageUrl: string }>();
    const jpeg = new File(["jpeg"], "profile.jpg", { type: "image/jpeg" });
    vi.mocked(prepareAvatar).mockReturnValue(prepared.promise);
    vi.mocked(auth.uploadProfileImage).mockReturnValue(uploaded.promise);
    vi.mocked(auth.updateProfile)
      .mockRejectedValueOnce(new AuthError(409, "NICKNAME_TAKEN", "이미 사용 중인 닉네임이에요."))
      .mockResolvedValueOnce();
    const wrapper = render(account.value);
    await wrapper.get(".home-edit-profile").trigger("click");
    await selectPhoto(wrapper);
    expect(wrapper.get(".profile-save").attributes("disabled")).toBeDefined();
    await wrapper.get("#home-profile-editor").trigger("submit");
    expect(auth.uploadProfileImage).not.toHaveBeenCalled();
    prepared.resolve(jpeg);
    await flushPromises();
    await wrapper.get("#profile-nickname").setValue("중복닉네임");
    await wrapper.get("#home-profile-editor").trigger("submit");
    await flushPromises();
    expect(auth.checkNickname).toHaveBeenCalledWith("중복닉네임");
    expect(auth.uploadProfileImage).toHaveBeenCalledWith(jpeg);
    expect(auth.updateProfile).not.toHaveBeenCalled();
    uploaded.resolve({ profileImageUrl: "https://images.example.com/new.jpg" });
    await flushPromises();
    expect(wrapper.get("#profile-nickname-help").text()).toContain("이미 사용 중");
    expect((wrapper.get("#profile-nickname").element as HTMLInputElement).value).toBe("중복닉네임");
    expect(wrapper.get(".profile-save").attributes("disabled")).toBeDefined();
    expect(document.activeElement?.id).toBe("profile-nickname");
    await wrapper.get("#profile-nickname").setValue("다른닉네임");
    await wrapper.get("#home-profile-editor").trigger("submit");
    await flushPromises();
    expect(auth.uploadProfileImage).toHaveBeenCalledTimes(1);
    expect(auth.updateProfile).toHaveBeenLastCalledWith({
      nickname: "다른닉네임",
      profileImageUrl: "https://images.example.com/new.jpg",
      githubUrl: null,
      contactEmail: null,
    });
    expect(wrapper.find("#home-profile-editor").exists()).toBe(false);
  });
  it("닉네임 중복 여부를 입력 중 표시하고 중복인 상태로 저장하지 않을 수 있다.", async () => {
    account.value = { ...userFixture("USER"), nickname: "기록자" };
    vi.mocked(auth.checkNickname).mockResolvedValueOnce({ available: false }).mockResolvedValueOnce({ available: true });
    const wrapper = render(account.value);
    await wrapper.get(".home-edit-profile").trigger("click");
    await wrapper.get("#profile-nickname").setValue("사용중닉네임");
    expect(wrapper.get("#profile-nickname-help").text()).toContain("확인하고 있어요");
    expect(auth.checkNickname).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(350);
    expect(wrapper.get("#profile-nickname-help").text()).toContain("이미 사용 중");
    expect(wrapper.get(".profile-save").attributes("disabled")).toBeDefined();
    await wrapper.get("#home-profile-editor").trigger("submit");
    expect(auth.updateProfile).not.toHaveBeenCalled();
    await wrapper.get("#profile-nickname").setValue("가능한닉네임");
    await vi.advanceTimersByTimeAsync(350);
    expect(wrapper.get("#profile-nickname-help").text()).toContain("사용할 수 있는");
    expect(wrapper.get(".profile-save").attributes("disabled")).toBeUndefined();
  });
  it("이전 닉네임 응답을 무시하고 실패한 검사를 다시 확인할 수 있다.", async () => {
    account.value = { ...userFixture("USER"), nickname: "기록자" };
    const previous = deferred<{ available: boolean }>();
    vi.mocked(auth.checkNickname)
      .mockReturnValueOnce(previous.promise)
      .mockRejectedValueOnce(new Error("닉네임을 확인하지 못했어요."))
      .mockResolvedValueOnce({ available: true });
    const wrapper = render(account.value);
    await wrapper.get(".home-edit-profile").trigger("click");
    await wrapper.get("#profile-nickname").setValue("이전닉네임");
    await vi.advanceTimersByTimeAsync(350);
    await wrapper.get("#profile-nickname").setValue("현재입력");
    await vi.advanceTimersByTimeAsync(350);
    previous.resolve({ available: true });
    await flushPromises();
    expect(wrapper.get("#profile-nickname-help").text()).toContain("확인하지 못했어요");
    await wrapper.get("#home-profile-editor").trigger("submit");
    expect(auth.updateProfile).not.toHaveBeenCalled();
    await wrapper.get("#profile-nickname-help button").trigger("click");
    await flushPromises();
    expect(auth.checkNickname).toHaveBeenLastCalledWith("현재입력");
    expect(wrapper.get("#profile-nickname-help").text()).toContain("사용할 수 있는");
    expect(wrapper.get(".profile-save").attributes("disabled")).toBeUndefined();
  });
  it("사진을 불러오지 못하면 닉네임 첫 글자를 대신 표시할 수 있다.", async () => {
    const owner = {
      ...userFixture("USER"),
      nickname: "기록자",
      profileImageUrl: "https://images.example.com/missing.png",
    };
    const wrapper = render(owner);
    await wrapper.get(".home-avatar img").trigger("error");
    expect(wrapper.find(".home-avatar img").exists()).toBe(false);
    expect(wrapper.get(".home-avatar").text()).toBe("기");
    await wrapper.setProps({ profile: createHomeProfile({ ...owner, profileImageUrl: "https://images.example.com/new.png" }) });
    expect(wrapper.get(".home-avatar img").attributes("src")).toBe("https://images.example.com/new.png");
  });
});
