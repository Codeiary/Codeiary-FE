import { createRouter, createWebHistory } from "vue-router";
import { checkAdminSession } from "./auth/admin";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      name: "city",
      component: () => import("./CityApp.vue"),
      meta: { title: "Codeiary — Commit to better." },
    },
    {
      path: "/admin/login",
      name: "admin-login",
      component: () => import("./pages/AdminLoginPage.vue"),
      meta: { title: "관리자 미리보기 — Codeiary" },
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

router.beforeEach(async (to) => {
  if (!to.meta.requiresAdmin && to.name !== "admin-login") return;
  const authenticated = await checkAdminSession();
  if (to.meta.requiresAdmin && !authenticated)
    return { name: "admin-login", replace: true };
  if (to.name === "admin-login" && authenticated)
    return { name: "admin", replace: true };
});
router.afterEach((to) => {
  document.title = String(to.meta.title || "Codeiary");
});

export default router;
