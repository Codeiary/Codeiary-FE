import { afterEach, expect, it } from "vitest";
import { createRouter, createMemoryHistory } from "vue-router";
import { updatePageSeo } from "@/utils/blog/seo";

afterEach(() => document.head.querySelectorAll('meta[name="robots"], link[rel="canonical"]').forEach((node) => node.remove()));

it("페이지 이동과 뒤로 가기에 맞춰 색인 설정을 갱신하고 다른 화면에서 제거할 수 있다.", async () => {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: "/blog", name: "blog", component: {} },
    { path: "/", name: "home", component: {}, meta: { title: "Codeiary" } },
  ] });
  router.afterEach(updatePageSeo);
  await router.push("/blog?page=2");
  expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("noindex, nofollow");
  await router.push("/blog");
  expect(document.querySelector('meta[name="robots"]')?.getAttribute("content")).toBe("index, follow");
  expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("https://codeiary.com/blog");
  await router.push("/");
  expect(document.querySelector('meta[name="robots"]')).toBeNull();
  expect(document.querySelector('link[rel="canonical"]')).toBeNull();
});
