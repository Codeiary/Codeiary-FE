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
    options.baseUrl ??
    import.meta.env.VITE_API_BASE_URL ??
    "/api"
  ).replace(/\/$/, "");

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const headers = new Headers(init.headers);
      headers.set("Accept", "application/json");
      headers.delete("Authorization");
      const response = await requestFetch(`${baseUrl}${path}`, {
        ...init,
        headers,
        signal: controller.signal,
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const code =
          typeof body.code === "string" ? body.code : "REQUEST_FAILED";
        const messages: Record<string, string> = {
          NICKNAME_TAKEN: "이미 사용 중인 닉네임이에요.",
          INVALID_NICKNAME: "닉네임 형식을 확인해 주세요.",
          INVALID_IMAGE: "사진을 읽을 수 없어요. 다른 이미지를 선택해 주세요.",
          IMAGE_UPLOAD_UNAVAILABLE: "사진 업로드를 준비 중이에요. 잠시 후 다시 시도해 주세요.",
          IMAGE_UPLOAD_FAILED: "사진을 저장하지 못했어요. 다시 시도해 주세요.",
        };
        const message = messages[code] ?? (
          response.status === 401 ? expiredMessage
            : response.status === 403 ? "이 작업을 할 수 있는 권한이 없어요."
              : response.status === 413 ? "사진 용량이 너무 커요. 다른 이미지를 선택해 주세요."
                : response.status === 429 ? "요청이 많아요. 잠시 후 다시 시도해 주세요."
                  : response.status === 400 ? "입력한 내용을 다시 확인해 주세요."
                    : "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요."
        );
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

  function post<T>(path: string, body?: object) {
    return request<T>(path, {
      method: "POST",
      ...(body === undefined ? {} : {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    });
  }

  return { request, post };
}
