import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import BlogPostList from "../src/blog/BlogPostList.vue";
import BlogPagination from "../src/blog/BlogPagination.vue";
import { postFixture } from "./fixtures/blog";

describe("블로그 페이지네이션", () => {
  it("글을 12개씩 나누어 중복 없이 마지막 페이지까지 볼 수 있다.", async () => {
    const posts = Array.from({ length: 27 }, (_, index) =>
      postFixture({ id: index + 1, title: `기록 ${index + 1}` }),
    );
    const wrapper = mount(BlogPostList, {
      props: {
        posts, personal: false, own: false,
        search: "", category: "", tag: "", sort: "latest", page: 1,
      },
    });
    try {
      const titles = () => wrapper.findAll(".post-card h3").map((card) => card.text());
      const first = titles();
      expect(first).toHaveLength(12);
      expect(wrapper.get('[aria-label="이전 페이지"]').attributes("disabled")).toBeDefined();
      await wrapper.get('[aria-label="2페이지"]').trigger("click");
      expect(wrapper.emitted("update:page")).toEqual([[2]]);
      await wrapper.setProps({ page: 2 });
      const second = titles();
      expect(second).toHaveLength(12);
      await wrapper.setProps({ page: 3 });
      const last = titles();
      expect(last).toEqual(["기록 3", "기록 2", "기록 1"]);
      expect(new Set([...first, ...second, ...last]).size).toBe(27);
      expect(wrapper.get('[aria-label="다음 페이지"]').attributes("disabled")).toBeDefined();
      await wrapper.setProps({ search: "기록 27" });
      expect(titles()).toEqual(["기록 27"]);
      expect(wrapper.get('[aria-current="page"]').text()).toBe("1");
      await wrapper.setProps({ search: "없는 글" });
      expect(wrapper.find(".blog-pagination").exists()).toBe(false);
      expect(wrapper.find(".blog-empty-state").exists()).toBe(true);
    } finally {
      wrapper.unmount();
    }
  });

  it("페이지가 많아도 현재 위치와 마지막 페이지를 확인하고 이동할 수 있다.", async () => {
    const wrapper = mount(BlogPagination, { props: { page: 1, pageCount: 234 } });
    try {
      expect(wrapper.text().replace(/\s/g, "")).toBe("12345…234");
      await wrapper.get('[aria-label="234페이지"]').trigger("click");
      expect(wrapper.emitted("select")).toEqual([[234]]);
      await wrapper.setProps({ page: 120 });
      expect(wrapper.text().replace(/\s/g, "")).toBe("1…119120121…234");
      expect(wrapper.get('[aria-current="page"]').text()).toBe("120");
    } finally {
      wrapper.unmount();
    }
  });
});
