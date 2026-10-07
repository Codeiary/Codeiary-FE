import { computed, readonly, ref, shallowRef } from "vue";
import { AuthError, createAuthApi } from "@/services/auth-api";

export { AuthError } from "@/services/auth-api";

export interface UserProfile {
  id: number;
  email: string;
  name: string;
  nickname?: string | null;
  profileImageUrl?: string | null;
  onboardingCompleted?: boolean;
  role: "ADMIN" | "USER";
}

const expiredMessage = "로그인이 만료되었어요. 다시 로그인해 주세요.";

export function createAuthSession(
  options: {
    fetch?: typeof fetch;
    storage?: () => Pick<Storage, "removeItem"> | null;
    baseUrl?: string;
  } = {},
) {
  const api = createAuthApi(options);
  const user = shallowRef<UserProfile | null>(null);
  const notice = ref("");
  const signingOut = ref(false);
  let revision = 0;
  let refreshVersion = 0;
  let initialization: Promise<boolean> | undefined;
  let refreshRequest: Promise<void> | undefined;
  let logoutRequest: Promise<void> | undefined;

  function clearLegacyTokens() {
    try {
      const storage = options.storage ? options.storage() : window.sessionStorage;
      storage?.removeItem("codeiary.session");
      storage?.removeItem("codeiary.oauth.mock.tokens");
    } catch {
      // Authentication uses browser cookies even when Web Storage is unavailable.
    }
  }

  function clearSession() {
    revision++;
    user.value = null;
    initialization = Promise.resolve(false);
    clearLegacyTokens();
  }

  function acceptProfile(profile: UserProfile) {
    if (
      !profile || !Number.isSafeInteger(profile.id) || profile.id <= 0 ||
      typeof profile.email !== "string" || typeof profile.name !== "string" ||
      !["ADMIN", "USER"].includes(profile.role)
    ) {
      throw new AuthError(0, "INVALID_RESPONSE", "로그인 정보를 확인하지 못했어요. 다시 시도해 주세요.");
    }
    user.value = profile;
    notice.value = "";
  }

  function requireCurrentSession(currentRevision: number) {
    if (currentRevision !== revision || signingOut.value)
      throw new AuthError(401, "SESSION_CHANGED", expiredMessage);
  }

  // Cookies are shared across tabs. Serialize rotation and logout where Web Locks are available.
  function withSessionLock<T>(action: () => Promise<T>): Promise<T> {
    if (typeof navigator !== "undefined" && navigator.locks)
      return navigator.locks.request("codeiary.auth.session", action);
    return action();
  }

  function refresh(): Promise<void> {
    if (refreshRequest) return refreshRequest;
    if (signingOut.value)
      return Promise.reject(new AuthError(401, "SIGNING_OUT", expiredMessage));
    const currentRevision = revision;
    refreshRequest = withSessionLock(async () => {
      requireCurrentSession(currentRevision);
      if (typeof navigator !== "undefined" && navigator.locks) {
        try {
          // Another tab may have already rotated the shared cookies while we waited.
          await api.request<UserProfile>("/users/me");
          refreshVersion++;
          return;
        } catch (error) {
          if (!(error instanceof AuthError) || error.status !== 401) throw error;
        }
      }
      requireCurrentSession(currentRevision);
      await api.post<void>("/auth/reissue");
      refreshVersion++;
    }).catch((error: unknown) => {
      if (currentRevision === revision && error instanceof AuthError) {
        if (error.status === 401) clearSession();
        notice.value = error.message;
      }
      throw error;
    }).finally(() => {
      refreshRequest = undefined;
    });
    return refreshRequest;
  }

  async function requestWithRefresh<T>(path: string, init: RequestInit = {}): Promise<T> {
    const currentRevision = revision;
    const currentRefreshVersion = refreshVersion;
    requireCurrentSession(currentRevision);
    try {
      return await api.request<T>(path, init);
    } catch (error) {
      if (!(error instanceof AuthError) || error.status !== 401) throw error;
      requireCurrentSession(currentRevision);
      // A late 401 reuses cookies already refreshed by another request.
      if (currentRefreshVersion === refreshVersion) await refresh();
      requireCurrentSession(currentRevision);
      try {
        return await api.request<T>(path, init);
      } catch (retryError) {
        if (retryError instanceof AuthError && retryError.status === 401 && currentRevision === revision) {
          clearSession();
          notice.value = expiredMessage;
        }
        throw retryError;
      }
    }
  }

  async function loadProfile() {
    const currentRevision = revision;
    const profile = await requestWithRefresh<UserProfile>("/users/me");
    requireCurrentSession(currentRevision);
    acceptProfile(profile);
  }

  function restore(): Promise<boolean> {
    if (initialization) return initialization;
    clearLegacyTokens();
    initialization = loadProfile().then(() => true).catch((error: unknown) => {
      if (error instanceof AuthError && error.status === 401) {
        if (!user.value && !signingOut.value) notice.value = "";
      } else {
        initialization = undefined;
        notice.value = error instanceof Error ? error.message : "로그인 상태를 확인하지 못했어요.";
      }
      return false;
    });
    return initialization;
  }

  async function completeOAuthLogin() {
    if (logoutRequest) await logoutRequest;
    if (initialization) await initialization;
    if (refreshRequest) await refreshRequest.catch(() => undefined);
    revision++;
    clearLegacyTokens();
    await loadProfile();
    initialization = Promise.resolve(true);
  }

  async function authorizedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
    await restore();
    return requestWithRefresh<T>(path, init);
  }

  async function checkNickname(nickname: string) {
    return authorizedRequest<{ available: boolean }>(
      `/users/nickname-availability?nickname=${encodeURIComponent(nickname.trim())}`,
    );
  }

  async function completeOnboarding(nickname: string, photo: File | null) {
    const currentRevision = revision;
    const form = new FormData();
    form.set("nickname", nickname.trim());
    if (photo) form.set("profileImage", photo);
    const profile = await authorizedRequest<UserProfile>("/users/me/onboarding", { method: "POST", body: form });
    requireCurrentSession(currentRevision);
    if (!profile.nickname || profile.onboardingCompleted !== true)
      throw new AuthError(0, "INVALID_RESPONSE", "프로필 저장 결과를 확인하지 못했어요.");
    acceptProfile(profile);
  }

  async function verifyAdmin() {
    const currentRevision = revision;
    const profile = await authorizedRequest<UserProfile>("/admin/me");
    requireCurrentSession(currentRevision);
    if (profile.role !== "ADMIN")
      throw new AuthError(403, "FORBIDDEN", "관리자만 접근할 수 있어요.");
    acceptProfile(profile);
  }

  function logout(): Promise<void> {
    if (logoutRequest) return logoutRequest;
    signingOut.value = true;
    revision++;
    logoutRequest = (async () => {
      if (initialization) await initialization;
      if (refreshRequest) await refreshRequest.catch(() => undefined);
      // Wait for Set-Cookie from rotation before revoking the current session.
      await withSessionLock(() => api.post<void>("/auth/logout"));
      clearSession();
      notice.value = "";
    })().finally(() => {
      signingOut.value = false;
      logoutRequest = undefined;
    });
    return logoutRequest;
  }

  async function revalidate() {
    if (signingOut.value) return;
    if (!user.value && !initialization) {
      await restore();
      return;
    }
    const hadUser = user.value !== null;
    try {
      await loadProfile();
      initialization = Promise.resolve(true);
    } catch (error) {
      if (error instanceof AuthError && error.code !== "SESSION_CHANGED") {
        notice.value = error.status === 401 && !hadUser ? "" : error.message;
      }
    }
  }

  return {
    user: readonly(user),
    notice: readonly(notice),
    signingOut: readonly(signingOut),
    restore,
    completeOAuthLogin,
    checkNickname,
    completeOnboarding,
    needsOnboarding: computed(() => user.value?.onboardingCompleted === false),
    logout,
    verifyAdmin,
    authorizedRequest,
    revalidate,
  };
}

export const auth = createAuthSession({
  fetch:
    import.meta.env.DEV && import.meta.env.VITE_AUTH_MOCK !== "false"
      ? async (input, init) =>
          (await import("@/services/mock-oauth")).mockOAuthFetch(input, init)
      : undefined,
});
