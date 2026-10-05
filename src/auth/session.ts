import { readonly, ref, shallowRef } from "vue";

export interface UserProfile {
  id: number;
  email: string;
  name: string;
  role: "ADMIN" | "USER";
}

interface TokenResponse {
  user: UserProfile;
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  refreshExpiresIn: number;
}

export class AuthError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const SESSION_KEY = "codeiary.session";
const expiredMessage = "로그인이 만료되었어요. 다시 로그인해 주세요.";

export function createAuthSession(
  options: {
    fetch?: typeof fetch;
    storage?: () => Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
    now?: () => number;
    baseUrl?: string;
  } = {},
) {
  const requestFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const storage = options.storage ?? (() => window.sessionStorage);
  const now = options.now ?? Date.now;
  const baseUrl = (
    options.baseUrl ??
    import.meta.env.VITE_API_BASE_URL ??
    "/api"
  ).replace(/\/$/, "");
  const user = shallowRef<UserProfile | null>(null);
  const notice = ref("");
  const signingOut = ref(false);
  let accessToken = "";
  let accessExpiresAt = 0;
  let refreshToken = "";
  let refreshExpiresAt = 0;
  let revision = 0;
  let initialization: Promise<boolean> | undefined;
  let refreshRequest: Promise<void> | undefined;
  let logoutRequest: Promise<void> | undefined;

  function persist() {
    try {
      if (refreshToken)
        storage()?.setItem(
          SESSION_KEY,
          JSON.stringify({ refreshToken, refreshExpiresAt }),
        );
      else storage()?.removeItem(SESSION_KEY);
    } catch {
      // Storage can be unavailable in private mode. The in-memory session still works.
    }
  }

  function clearSession() {
    revision++;
    user.value = null;
    accessToken = refreshToken = "";
    accessExpiresAt = refreshExpiresAt = 0;
    persist();
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await requestFetch(`${baseUrl}${path}`, {
        ...init,
        headers: { Accept: "application/json", ...init.headers },
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const code =
          typeof body.code === "string" ? body.code : "REQUEST_FAILED";
        const message =
          code === "INVALID_CREDENTIALS"
            ? "이메일 또는 비밀번호를 확인해 주세요."
            : response.status === 401
              ? expiredMessage
              : response.status === 403
                ? "관리자만 접근할 수 있어요."
                : response.status === 429
                  ? "요청이 많아요. 잠시 후 다시 시도해 주세요."
                  : response.status === 400
                    ? "입력한 내용을 다시 확인해 주세요."
                    : "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.";
        throw new AuthError(response.status, code, message);
      }
      return response.status === 204 ? (undefined as T) : await response.json();
    } catch (error) {
      if (error instanceof AuthError) throw error;
      throw new AuthError(
        0,
        "NETWORK_ERROR",
        "서버에 연결하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  function post<T>(path: string, body: object) {
    return request<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  function acceptTokens(tokens: TokenResponse) {
    if (
      !tokens.accessToken ||
      !tokens.refreshToken ||
      tokens.tokenType !== "Bearer" ||
      !(tokens.expiresIn > 0) ||
      !(tokens.refreshExpiresIn > 0) ||
      !tokens.user ||
      !["ADMIN", "USER"].includes(tokens.user.role)
    ) {
      throw new AuthError(
        0,
        "INVALID_RESPONSE",
        "로그인 응답을 확인하지 못했어요. 다시 시도해 주세요.",
      );
    }
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
    accessExpiresAt = now() + tokens.expiresIn * 1000;
    refreshExpiresAt = now() + tokens.refreshExpiresIn * 1000;
    user.value = tokens.user;
    notice.value = "";
    persist();
  }

  function refresh(): Promise<void> {
    if (refreshRequest) return refreshRequest;
    if (signingOut.value)
      return Promise.reject(new AuthError(401, "SIGNING_OUT", expiredMessage));
    if (!refreshToken || refreshExpiresAt <= now()) {
      clearSession();
      notice.value = expiredMessage;
      return Promise.reject(
        new AuthError(401, "INVALID_REFRESH_TOKEN", expiredMessage),
      );
    }
    const currentRevision = revision;
    refreshRequest = post<TokenResponse>("/auth/refresh", { refreshToken })
      .then((tokens) => {
        if (currentRevision === revision) acceptTokens(tokens);
      })
      .catch((error: unknown) => {
        if (currentRevision === revision && error instanceof AuthError) {
          if (error.status === 400 || error.status === 401) clearSession();
          notice.value = error.message;
        }
        throw error;
      })
      .finally(() => {
        refreshRequest = undefined;
      });
    return refreshRequest;
  }

  function restore(): Promise<boolean> {
    if (initialization) return initialization;
    initialization = (async () => {
      try {
        const saved = JSON.parse(storage()?.getItem(SESSION_KEY) ?? "null");
        if (
          typeof saved?.refreshToken === "string" &&
          Number.isFinite(saved.refreshExpiresAt)
        ) {
          refreshToken = saved.refreshToken;
          refreshExpiresAt = saved.refreshExpiresAt;
        } else if (saved) persist();
      } catch {
        /* Missing or invalid browser storage does not prevent sign-in. */
      }
      if (refreshToken) {
        try {
          await refresh();
        } catch {
          /* The login page displays notice and allows retry. */
        }
      }
      return user.value !== null;
    })();
    return initialization;
  }

  async function login(email: string, password: string) {
    await restore();
    if (logoutRequest) await logoutRequest;
    if (refreshRequest) await refreshRequest.catch(() => undefined);
    revision++;
    const tokens = await post<TokenResponse>("/auth/login", {
      email,
      password,
    });
    acceptTokens(tokens);
  }

  async function authorizedRequest<T>(path: string): Promise<T> {
    await restore();
    if (signingOut.value)
      throw new AuthError(401, "SIGNING_OUT", expiredMessage);
    if (!accessToken || accessExpiresAt <= now() + 15_000) await refresh();
    const token = accessToken;
    const currentRevision = revision;
    try {
      return await request<T>(path, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      if (
        !(error instanceof AuthError) ||
        error.status !== 401 ||
        currentRevision !== revision
      )
        throw error;
      // Concurrent 401 responses must reuse the token already rotated by the first request.
      if (accessToken === token) await refresh();
      try {
        return await request<T>(path, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch (retryError) {
        if (
          retryError instanceof AuthError &&
          retryError.status === 401 &&
          currentRevision === revision
        ) {
          clearSession();
          notice.value = expiredMessage;
        }
        throw retryError;
      }
    }
  }

  async function verifyAdmin() {
    const currentRevision = revision;
    const profile = await authorizedRequest<UserProfile>("/admin/me");
    if (currentRevision !== revision || signingOut.value)
      throw new AuthError(401, "SESSION_CHANGED", expiredMessage);
    if (profile.role !== "ADMIN")
      throw new AuthError(403, "FORBIDDEN", "관리자만 접근할 수 있어요.");
    user.value = profile;
  }

  function logout(): Promise<void> {
    if (logoutRequest) return logoutRequest;
    signingOut.value = true;
    logoutRequest = (async () => {
      await restore();
      if (refreshRequest) await refreshRequest.catch(() => undefined);
      // Revoke on the server first. A failed request keeps the session available for retry.
      if (refreshToken) await post<void>("/auth/logout", { refreshToken });
      clearSession();
      notice.value = "";
    })().finally(() => {
      signingOut.value = false;
      logoutRequest = undefined;
    });
    return logoutRequest;
  }

  async function revalidate() {
    await restore();
    if (user.value && accessExpiresAt <= now() + 15_000 && !signingOut.value) {
      await refresh().catch(() => undefined);
    }
  }

  return {
    user: readonly(user),
    notice: readonly(notice),
    signingOut: readonly(signingOut),
    restore,
    login,
    logout,
    verifyAdmin,
    authorizedRequest,
    revalidate,
  };
}

export const auth = createAuthSession();
