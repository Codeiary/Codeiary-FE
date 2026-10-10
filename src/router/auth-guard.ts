import type { RouteLocationNormalized } from "vue-router";
import { AuthError, auth } from "@/store/auth";

import { safeAuthReturn } from "@/utils/auth/oauth";

export function loginDestination(value: unknown) {
  const target = safeAuthReturn(value);
  return target === "/admin" && auth.user.value?.role !== "ADMIN"
    ? "/"
    : target;
}

export async function authGuard(to: RouteLocationNormalized) {
  if (to.name === "oauth-callback") return;
  if (!to.meta.requiresAuth && !to.meta.requiresAdmin && to.name !== "login") {
    void auth.restore();
    return;
  }
  await auth.restore();
  if (auth.needsOnboarding.value && to.name !== "onboarding")
    return {
      name: "onboarding",
      query: { redirect: safeAuthReturn(to.query.redirect ?? to.fullPath) },
      replace: true,
    };
  if (
    to.name === "onboarding" &&
    auth.user.value &&
    !auth.needsOnboarding.value
  )
    return { path: loginDestination(to.query.redirect), replace: true };
  if (to.name === "login" && auth.user.value && to.query.retry !== "1")
    return { path: loginDestination(to.query.redirect), replace: true };
  if (to.meta.requiresAuth && !auth.user.value)
    return { name: "login", query: { redirect: to.path }, replace: true };
  if (!to.meta.requiresAdmin) return;
  if (!auth.user.value)
    return { name: "login", query: { redirect: "/admin" }, replace: true };
  try {
    await auth.verifyAdmin();
  } catch (error) {
    if (error instanceof AuthError && error.status === 403)
      return { name: "city", query: { access: "denied" }, replace: true };
    return {
      name: "login",
      query: { redirect: "/admin", retry: "1" },
      replace: true,
    };
  }
}
