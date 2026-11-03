import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deferred } from "./fixtures/auth";

import { flushPromises } from "@vue/test-utils";

const request = vi.hoisted(() => vi.fn());
const fetchCount = vi.hoisted(() => vi.fn());
vi.mock("@/services/auth-api", () => ({ createAuthApi: () => ({ request }) }));
vi.mock("@/services/blog-api", () => ({ fetchMyPostCount: fetchCount }));
vi.mock("@/store/auth", async () => ({
  auth: { user: (await import("vue")).shallowRef({
    id: 1, name: "기록자", nickname: "내 닉네임", email: "writer@example.com", role: "USER",
  }) },
}));

const page = {
  content: [{ id: 1, nickname: "이웃", postCount: 10, profileImageUrl: null,
    githubUrl: null, contactEmail: null }],
  totalPages: 1,
};

beforeEach(() => {
  vi.resetModules();
  request.mockReset();
  fetchCount.mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(0);
});
afterEach(() => vi.useRealTimers());

describe("공개 이웃 목록 캐시", () => {
  it("재방문에 캐시를 사용하고 오래된 목록도 갱신을 기다리지 않고 보여줄 수 있다.", async () => {
    const response = deferred<typeof page>();
    const refresh = deferred<typeof page>();
    request.mockReturnValueOnce(response.promise).mockReturnValueOnce(refresh.promise);
    const { loadNeighborhoodResidents, neighborhoodResidents } = await import("@/store/neighborhood");
    const first = loadNeighborhoodResidents();
    const concurrent = loadNeighborhoodResidents();
    expect(request).toHaveBeenCalledTimes(1);
    expect(concurrent).toBe(first);
    response.resolve(page);
    await first;
    const residents = neighborhoodResidents.value;
    await loadNeighborhoodResidents();
    expect(neighborhoodResidents.value).toBe(residents);
    expect(request).toHaveBeenCalledTimes(1);
    vi.setSystemTime(30_001);
    await loadNeighborhoodResidents();
    expect(neighborhoodResidents.value).toBe(residents);
    expect(request).toHaveBeenCalledTimes(2);
    refresh.resolve({ ...page, content: [{ ...page.content[0]!, postCount: 20 }] });
    await flushPromises();
    expect(neighborhoodResidents.value[0]?.level).toBe(2);
  });

  it("이웃 목록을 불러오지 못한 뒤 다시 요청할 수 있다.", async () => {
    request.mockRejectedValueOnce(new Error("Disconnected")).mockResolvedValueOnce(page);
    const { loadNeighborhoodResidents, neighborhoodResidents } = await import("@/store/neighborhood");
    await loadNeighborhoodResidents();
    expect(neighborhoodResidents.value).toEqual([]);
    await loadNeighborhoodResidents();
    expect(neighborhoodResidents.value).toEqual([
      expect.objectContaining({ id: 1, nickname: "이웃", level: 1 }),
    ]);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
