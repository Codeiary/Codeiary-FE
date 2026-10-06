import type { RouteLocationNormalized } from "vue-router";
import { AuthError, auth } from "./session";

// Only known app destinations are accepted; query strings cannot create external redirects.
export function loginDestination(value: unknown) {
  if (typeof value === "string" && /^\/write(?:\/[a-f0-9-]{36})?$/.test(value))
    return value;
  return value === "/admin" && auth.user.value?.role === "ADMIN"
    ? "/admin"
    : "/";
}

export async function authGuard(to: RouteLocationNormalized) {
  await auth.restore();
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
