export class AuthError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const expiredMessage = "로그인이 만료되었어요. 다시 로그인해 주세요.";

export function createAuthApi(
  options: { fetch?: typeof fetch; baseUrl?: string } = {},
) {
  const requestFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const baseUrl = (
    options.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? "/api"
  ).replace(/\/$/, "");

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

  return { request, post };
}
