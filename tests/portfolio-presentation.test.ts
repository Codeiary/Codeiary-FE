import { mount, flushPromises } from "@vue/test-utils";
import { describe, it, expect, vi } from "vitest";
import { createRouter, createMemoryHistory } from "vue-router";
import PortfolioPresentationView from "@/views/PortfolioPresentationView.vue";
import { portfolioRoute } from "@/utils/portfolio/routes";
vi.mock("@/services/portfolio-api", () => ({ fetchPortfolio: vi.fn(async (id: number) => ({
  id, title: "개발자 포트폴리오", content: "소개", summary: "", visibility: "PUBLIC", author: { id: 1, name: "기록자" }, blocks: [],
})) }));
vi.mock("@/utils/portfolio/fonts", async (original) => ({ ...await original<typeof import("@/utils/portfolio/fonts")>(), loadPortfolioFont: vi.fn() }));

describe("포트폴리오 주소와 전체 화면 보기", () => {
  it("같은 제목도 ID로 구분하고 사이트 상단바 없이 문서를 표시한다", async () => {
    const component = PortfolioPresentationView;
    const router = createRouter({ history: createMemoryHistory(), routes: [
      { path: "/portfolio/:portfolioSlug/:portfolioId/view", name: "portfolio-view", component },
    ] });
    expect(portfolioRoute({ id: 1, title: "같은 제목" }).params.portfolioId).not.toBe(portfolioRoute({ id: 2, title: "같은 제목" }).params.portfolioId);
    await router.push(portfolioRoute({ id: 4, title: "개발자 포트폴리오" }, true));
    await router.isReady();
    const wrapper = mount(component, { global: { plugins: [router] } });
    try {
      await flushPromises();
      expect(wrapper.get(".portfolio-document-title").text()).toBe("개발자 포트폴리오");
      expect(wrapper.find(".site-header, .portfolio-document-actions").exists()).toBe(false);
      expect(router.currentRoute.value.params.portfolioId).toBe("4");
      expect(router.currentRoute.value.path).toMatch(/\/4\/view$/);
    } finally { wrapper.unmount(); }
  });
});
