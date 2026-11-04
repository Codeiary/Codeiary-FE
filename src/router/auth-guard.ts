import type { RouteLocationNormalized } from "vue-router";
import { AuthError, auth } from "@/store/auth";

import { homeRoute, hasNicknamePath } from "@/utils/profile/home-route";
import { fetchHomeProfile } from "@/services/profile-api";
import { safeAuthReturn } from "@/utils/auth/oauth";

export function loginDestination(value: unknown) {
  const target = safeAuthReturn(value);
  return target === "/admin" && auth.user.value?.role !== "ADMIN"
    ? "/"
    : target;
}

export async function authGuard(to: RouteLocationNormalized) {
  if (to.name === "oauth-callback") return;
  if (to.name === "user-home" && to.query.resident) {
    try {
      const profile = await fetchHomeProfile(Number(to.query.resident));
      if (hasNicknamePath(profile.owner.nickname)) {
        const { resident, ...query } = to.query;
        return { name: "user-profile", params: { nickname: profile.owner.nickname }, query, replace: true };
      }
    } catch { /* The home page renders a missing-profile message. */ }
  }
  if (to.name === "user-home" && !to.query.resident) {
    await auth.restore();
    if (hasNicknamePath(auth.user.value?.nickname)) return { ...homeRoute(auth.user.value!), query: to.query, replace: true };
  }
  const requiresAuth = to.meta.requiresAuth || (to.name === "user-home" && !to.query.resident);
  if (!requiresAuth && !to.meta.requiresAdmin && to.name !== "login") {
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
  if (requiresAuth && !auth.user.value)
    return { name: "login", query: { redirect: to.name === "portfolio-write" ? to.fullPath : to.path }, replace: true };
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
