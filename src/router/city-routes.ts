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
    path: "/blog/:authorSlug/:postSlug",
    name: "blog-post",
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
    path: "/news",
    name: "news",
    component: content,
    meta: { section: "news", title: "최근 IT 이슈 — Codeiary" },
  },
  {
    path: "/home",
    name: "user-home",
    component: content,
    meta: { section: "home", title: "내 집 — Codeiary" },
  },
];
