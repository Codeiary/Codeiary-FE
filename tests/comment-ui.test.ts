// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { deleteDB } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { ref } from "vue";
import { createRouter, createMemoryHistory } from "vue-router";
import type { UserProfile } from "@/store/auth";
import PostComments from "@/components/blog/comments/PostComments.vue";
import CommentComposer from "@/components/blog/comments/CommentComposer.vue";
import { createComment } from "@/services/comment-storage";
import { commentPostKey } from "@/utils/blog/comments";
import { postFixture } from "./fixtures/blog";
import { commentAuthorFixture } from "./fixtures/comments";
import { userFixture } from "./fixtures/auth";
vi.mock("@/store/auth", () => ({
  auth: {
    get user() {
      return session;
    },
  },
}));
const session = ref<UserProfile | null>(null);
const wrappers: VueWrapper[] = [];
beforeEach(async () => {
  session.value = null;
  await deleteDB("codeiary.comments.mock.v1");
});
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()));
async function render() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/blog/test/post", component: { template: "<div />" } },
      { path: "/login", name: "login", component: { template: "<div />" } },
    ],
  });
  await router.push("/blog/test/post");
  const wrapper = mount(PostComments, {
    props: { post: postFixture() },
    global: { plugins: [router] },
    attachTo: document.body,
  });
  wrappers.push(wrapper);
  await vi.waitFor(() => expect(wrapper.text()).not.toContain("불러오는 중"));
  return wrapper;
}
describe("댓글 화면", () => {
  it("비로그인 사용자가 댓글을 읽고 현재 글로 돌아오는 로그인 링크를 볼 수 있다.", async () => {
    await createComment(
      commentPostKey(postFixture()),
      commentAuthorFixture(),
      "읽을 수 있는 댓글",
    );
    const wrapper = await render();
    expect(wrapper.text()).toContain("읽을 수 있는 댓글");
    expect(wrapper.find("textarea").exists()).toBe(false);
    expect(wrapper.find('[aria-label="댓글 수정"]').exists()).toBe(false);
    expect(wrapper.get(".comments-login a").attributes("href")).toContain(
      "redirect=/blog/test/post",
    );
  });
  it("닉네임으로 댓글을 등록하고 수정 및 삭제를 확인할 수 있다.", async () => {
    session.value = { ...userFixture(), nickname: "커밋여행자" };
    const wrapper = await render();
    await wrapper.get("textarea").setValue("처음 남긴 댓글 🚀");
    await wrapper.get("form").trigger("submit");
    await vi.waitFor(() =>
      expect(wrapper.findAll(".comment-item")).toHaveLength(1),
    );
    expect(wrapper.get(".comment-identity strong").text()).toBe("커밋여행자");
    await wrapper.get('[aria-label="댓글 수정"]').trigger("click");
    await wrapper
      .get('[aria-label="커밋여행자의 댓글"] textarea')
      .setValue("바꾼 댓글");
    await wrapper.get(".comment-item form").trigger("submit");
    await vi.waitFor(() => expect(wrapper.text()).toContain("수정됨"));
    await wrapper.get('[aria-label="댓글 삭제"]').trigger("click");
    await wrapper.get(".comment-delete-approve").trigger("click");
    await vi.waitFor(() =>
      expect(wrapper.findAll(".comment-item")).toHaveLength(0),
    );
  });
  it("다른 사용자의 댓글에 답글을 달고 계정을 바꾸면 작성 내용을 비울 수 있다.", async () => {
    await createComment(
      commentPostKey(postFixture()),
      commentAuthorFixture({ id: 2 }),
      "다른 사람의 댓글",
    );
    session.value = userFixture();
    const wrapper = await render();
    expect(wrapper.find('[aria-label="댓글 삭제"]').exists()).toBe(false);
    await wrapper.get(".comment-reply-action").trigger("click");
    await wrapper.get(".comment-item textarea").setValue("답글입니다");
    await wrapper.get(".comment-item form").trigger("submit");
    await vi.waitFor(() =>
      expect(wrapper.findAll(".comment-item-reply")).toHaveLength(1),
    );
    expect(
      wrapper.get(".comment-item-reply").find(".comment-reply-action").exists(),
    ).toBe(false);
    await wrapper.get("textarea").setValue("다른 계정에 남으면 안 되는 내용");
    session.value = { ...userFixture(), id: 3 };
    await flushPromises();
    expect((wrapper.get("textarea").element as HTMLTextAreaElement).value).toBe(
      "",
    );
    expect(wrapper.find('[aria-label="댓글 삭제"]').exists()).toBe(false);
  });
  it("이모지를 커서 위치에 삽입하고 등록할 수 있다.", async () => {
    const wrapper = mount(CommentComposer);
    wrappers.push(wrapper);
    await wrapper.get("textarea").setValue("안녕 세계");
    const input = wrapper.get("textarea").element as HTMLTextAreaElement;
    input.setSelectionRange(2, 2);
    await wrapper.get('[aria-label="이모지 선택"]').trigger("click");
    await wrapper.get('[aria-label="🎉 삽입"]').trigger("click");
    expect(input.value).toBe("안녕🎉 세계");
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("submit")?.[0]).toEqual(["안녕🎉 세계"]);
  });
});
