import { readonly, shallowRef } from "vue";

export interface AdminUser {
  id: string;
  name: string;
  role: "ADMIN";
}
export interface AdminSession {
  authenticated: boolean;
  user: AdminUser | null;
}
export interface AdminAuthProvider {
  getSession(): Promise<AdminSession>;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}

// Development preview only. Refreshing the page clears this in-memory session.
// Replace this provider with the JWT API adapter when the backend is ready.
const mockSession: AdminSession = { authenticated: false, user: null };
const authProvider: AdminAuthProvider = {
  async getSession() {
    return { ...mockSession };
  },
  async signIn() {
    mockSession.authenticated = true;
    mockSession.user = { id: "demo-admin", name: "김원석", role: "ADMIN" };
  },
  async signOut() {
    mockSession.authenticated = false;
    mockSession.user = null;
  },
};

const userState = shallowRef<AdminUser | null>(null);
export const adminUser = readonly(userState);

export async function checkAdminSession() {
  try {
    const session = await authProvider.getSession();
    const authorized = session.authenticated && session.user?.role === "ADMIN";
    userState.value = authorized ? session.user : null;
    return Boolean(authorized);
  } catch {
    userState.value = null;
    return false;
  }
}
export async function signInDemoAdmin() {
  await authProvider.signIn();
  if (!(await checkAdminSession()))
    throw new Error("Admin session unavailable");
}
export async function signOutAdmin() {
  await authProvider.signOut();
  userState.value = null;
}
