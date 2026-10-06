import type { UserProfile } from "@/store/auth";

export const credentials = {
  email: "writer@example.com",
  password: "sample123!@#",
};
export function userFixture(role: UserProfile["role"] = "ADMIN"): UserProfile {
  return { id: 1, name: "기록자", email: credentials.email, role };
}
export function tokenFixture(
  suffix = "first",
  role: UserProfile["role"] = "ADMIN",
) {
  return {
    accessToken: `access-${suffix}`,
    refreshToken: `refresh-${suffix}`,
    tokenType: "Bearer",
    expiresIn: 1800,
    refreshExpiresIn: 604800,
    user: userFixture(role),
  };
}
export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
export function storageFixture() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
