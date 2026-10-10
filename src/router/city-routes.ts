import type { RouteRecordRaw } from "vue-router";

const city = () => import("@/views/CityView.vue");

export const cityRoutes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "city",
    component: city,
    meta: { title: "Codeiary — Code Diary" },
    beforeEnter: (to) => {
      if (to.query.view === "blog") return { name: "blog", replace: true };
    },
  },
  {
    path: "/blog",
    name: "blog",
    component: city,
    meta: { blog: true, title: "Blog House — Codeiary" },
  },
  {
    path: "/blog/:authorSlug",
    name: "user-blog",
    component: city,
    meta: { blog: true, title: "블로그 — Codeiary" },
  },
  {
    path: "/blog/:authorSlug/:postSlug",
    name: "blog-post",
    component: city,
    meta: { blog: true, title: "블로그 글 — Codeiary" },
  },
];
