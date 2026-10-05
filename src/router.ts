import { createRouter, createWebHistory } from "vue-router";
import { authGuard } from "./auth/navigation";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "city",
      component: () => import("./CityApp.vue"),
      meta: { title: "Codeiary — Code Diary" },
    },
    {
      path: "/login",
      name: "login",
      component: () => import("./pages/LoginPage.vue"),
      meta: { title: "로그인 — Codeiary" },
    },
    {
      path: "/admin/login",
      redirect: { name: "login", query: { redirect: "/admin" } },
    },
    {
      path: "/admin",
      name: "admin",
      component: () => import("./pages/AdminPage.vue"),
      meta: { requiresAdmin: true, title: "관리자 — Codeiary" },
    },
    { path: "/admin/:pathMatch(.*)*", redirect: { name: "admin" } },
    { path: "/:pathMatch(.*)*", redirect: { name: "city" } },
  ],
});

router.beforeEach(authGuard);
router.afterEach((to) => {
  document.title = String(to.meta.title || "Codeiary");
});

export default router;
