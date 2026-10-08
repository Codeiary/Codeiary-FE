import { createRouter, createWebHistory } from "vue-router";
import { authGuard } from "@/router/auth-guard";
import { cityRoutes } from "@/router/city-routes";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    ...cityRoutes,
    {
      path: "/write/:draftId?",
      name: "blog-write",
      component: () => import("@/views/WriteView.vue"),
      meta: { requiresAuth: true, title: "글쓰기 — Codeiary" },
    },
    {
      path: "/login",
      name: "login",
      component: () => import("@/views/LoginView.vue"),
      meta: { title: "로그인 — Codeiary" },
    },
    {
      path: "/auth/callback",
      name: "oauth-callback",
      component: () => import("@/views/OAuthCallbackView.vue"),
      meta: { title: "Google 로그인 — Codeiary" },
    },
    {
      path: "/onboarding",
      name: "onboarding",
      component: () => import("@/views/OnboardingView.vue"),
      meta: { requiresAuth: true, title: "닉네임 설정 — Codeiary" },
    },
    {
      path: "/admin/login",
      redirect: { name: "login", query: { redirect: "/admin" } },
    },
    {
      path: "/admin",
      name: "admin",
      component: () => import("@/views/AdminView.vue"),
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
