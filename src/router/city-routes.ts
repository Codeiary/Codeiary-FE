import type { RouteRecordRaw } from "vue-router";

const city = () => import("@/views/CityView.vue");
const content = () => import("@/views/ContentView.vue");

export const cityRoutes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "city",
    component: city,
    meta: { title: "Codeiary — Code Diary" },
    beforeEnter: (to) => {
      const { view, ...query } = to.query;
      if (view === "blog" || view === "portfolio" || view === "news" || view === "home")
        return { name: view === "home" ? "user-home" : view, query, replace: true };
    },
  },
  {
    path: "/blog",
    name: "blog",
    component: content,
    meta: { blog: true, section: "blog", title: "Blog House — Codeiary" },
  },
  {
    path: "/blog/:authorSlug",
    name: "user-blog",
    component: content,
    meta: { blog: true, section: "blog", title: "블로그 — Codeiary" },
  },
  {
    path: "/blog/:authorSlug/:postSlug/:postId(\\d+)",
    name: "blog-post",
    component: content,
    meta: { blog: true, section: "blog", title: "블로그 글 — Codeiary" },
  },
  {
    path: "/blog/:authorSlug/:postSlug",
    name: "blog-post-legacy",
    component: content,
    meta: { blog: true, section: "blog", title: "블로그 글 — Codeiary" },
  },
  {
    path: "/portfolio",
    name: "portfolio",
    component: content,
    meta: { section: "portfolio", title: "포트폴리오 — Codeiary" },
  },
  {
    path: "/portfolio/:portfolioSlug/:portfolioId(\\d+)/view",
    name: "portfolio-view",
    component: () => import("@/views/PortfolioPresentationView.vue"),
    meta: { section: "portfolio", title: "포트폴리오 — Codeiary" },
  },
  {
    path: "/portfolio/:portfolioSlug/:portfolioId(\\d+)",
    name: "portfolio-detail",
    component: content,
    meta: { section: "portfolio", title: "포트폴리오 — Codeiary" },
  },
  {
    path: "/portfolio/manage",
    name: "portfolio-manage",
    redirect: (to) => to.query.portfolioId
      ? { name: "portfolio", query: { portfolioId: to.query.portfolioId } }
      : { name: "user-home", query: { tab: "portfolio" } },
  },
  {
    path: "/portfolio/write",
    name: "portfolio-write",
    component: () => import("@/views/PortfolioWriteView.vue"),
    meta: { requiresAuth: true, title: "포트폴리오 작성 — Codeiary" },
  },
  {
    path: "/news",
    name: "news",
    component: content,
    meta: { section: "news", title: "최근 IT 이슈 — Codeiary" },
  },
  {
    path: "/:nickname([가-힣A-Za-z0-9_]{2,20})",
    name: "user-profile",
    component: content,
    meta: { section: "home", title: "사용자의 집 — Codeiary" },
  },
  {
    path: "/home",
    name: "user-home",
    component: content,
    meta: { section: "home", title: "마이페이지 — Codeiary" },
  },
];
