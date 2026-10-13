// @vitest-environment node
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { expect, it, vi } from "vitest";
import { createAuthApi } from "@/services/auth-api";

it("운영 빌드 설정으로 API에 직접 쿠키 요청을 보내고 Bearer 토큰을 전달하지 않는다.", async () => {
  const env = loadEnv("production", fileURLToPath(new URL("../", import.meta.url)), "VITE_");
  expect(env.VITE_API_BASE_URL).toBe("https://api.codeiary.com/api");
  expect(env.VITE_GOOGLE_AUTH_URL).toBe("https://api.codeiary.com/oauth2/authorization/google");

  vi.stubEnv("VITE_API_BASE_URL", env.VITE_API_BASE_URL);
  try {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: 1 }));
    const api = createAuthApi({ fetch: request });
    await expect(api.request("/users/me", {
      headers: { Authorization: "Bearer legacy-token" },
    })).resolves.toEqual({ id: 1 });
    const [url, init] = request.mock.calls[0]!;
    expect(url).toBe("https://api.codeiary.com/api/users/me");
    expect(init?.credentials).toBe("include");
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
  } finally {
    vi.unstubAllEnvs();
  }
});
