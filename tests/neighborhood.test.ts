import { afterEach, describe, expect, it, vi } from "vitest";
import { computed, effectScope, nextTick, shallowRef } from "vue";

import * as service from "@/services/neighborhood";
import { useNeighborhood } from "@/composables/useNeighborhood";
import { orderedResidences } from "@/utils/city/residences";
import { userFixture, deferred } from "./fixtures/auth";
import { postFixture } from "./fixtures/blog";

afterEach(() => vi.restoreAllMocks());

describe("유저 집과 지연 로딩", () => {

  it("게시글 수 10개마다 사용자의 집 레벨을 올릴 수 있다.", () => {
    const user = userFixture();
    const posts = Array.from({ length: 21 }, (_, id) =>
      postFixture({ id, author: { id: user.id, name: user.name } }),
    );
    const home = service.residenceDirectory(user, posts, 20)
      .find((resident) => resident.id === user.id);
    expect(home).toMatchObject({ postCount: 20, level: 2, activityPoints: null });
  });

  it("로그인한 사용자의 집도 이웃 목록에 표시할 수 있다.", () => {
    const user = userFixture("USER");
    const directory = service.residenceDirectory(user, []);
    const neighbors = orderedResidences(directory);
    expect(neighbors.some((home) => home.id === user.id)).toBe(true);
    expect(neighbors.some((home) => home.role === "ADMIN")).toBe(false);
    expect(orderedResidences(directory)).toHaveLength(directory.length);
  });

  it("사용자 목록이 바뀐 뒤 도착한 이전 구역 응답을 무시할 수 있다.", async () => {
    const source = shallowRef(service.residenceDirectory(null, Array.from({ length: 20 }, (_, id) =>
      postFixture({ id, author: { id, name: `user-${id}` } }),
    )));
    const directory = computed(() => source.value);
    const stale = deferred<service.NeighborhoodBlock>();
    const oldBlock = await service.fetchNeighborhoodBlock(directory.value, 0);
    vi.spyOn(service, "fetchNeighborhoodBlock").mockImplementationOnce(
      () => stale.promise,
    );
    const scope = effectScope();
    const neighborhood = scope.run(() => useNeighborhood(directory))!;
    try {
      const first = neighborhood.ensureBlock(0);
      source.value = [
        { ...source.value[0]!, id: 999, activity: 999 },
        ...source.value,
      ];
      await nextTick();
      await neighborhood.goToPage(0);
      const current = neighborhood.visibleBlocks.value[0];
      stale.resolve(oldBlock);
      await first;
      expect(neighborhood.visibleBlocks.value[0]).toBe(current);
      expect(current?.residents[0]?.id).toBe(999);
    } finally {
      scope.stop();
    }
  });
});
