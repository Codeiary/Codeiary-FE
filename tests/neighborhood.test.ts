import { afterEach, describe, expect, it, vi } from "vitest";
import { computed, effectScope, nextTick, shallowRef } from "vue";
import { flushPromises } from "@vue/test-utils";
import * as service from "@/services/neighborhood";
import { useNeighborhood } from "@/composables/useNeighborhood";
import {
  residencePosition,
  orderedResidences,
  RESIDENTIAL_START,
  BLOCK_WIDTH,
} from "@/utils/city/residences";
import {
  normalizeHouseLevel,
  residenceTier,
  houseLevelForPostCount,
} from "@/utils/city/residence-tiers";
import { canWalk, findPath } from "@/utils/city/navigation";
import {
  neighborhoodLayout,
  parkFeatureObstacle,
  NEIGHBORHOOD_DEPTH,
} from "@/utils/city/neighborhood-layouts";
import { userFixture, deferred } from "./fixtures/auth";
import { postFixture } from "./fixtures/blog";

afterEach(() => vi.restoreAllMocks());

describe("유저 집과 지연 로딩", () => {
  it("닉네임으로 집을 검색하고 닉네임이 없으면 기존 이름으로 찾을 수 있다.", () => {
    const user = { ...userFixture(), nickname: "  커밋여행자  " };
    const homes = service.residenceDirectory(user, []);
    expect(
      service.searchResidences(homes, "커밋여행자").map((home) => home.id),
    ).toEqual([user.id]);
    expect(service.searchResidences(homes, user.name)).toEqual([]);
    expect(
      service
        .searchResidences(
          service.residenceDirectory({ ...user, nickname: " " }, []),
          user.name,
        )
        .map((home) => home.id),
    ).toEqual([user.id]);
  });

  it("레벨에 따라 지정된 층수와 VIP 건물을 선택할 수 있다.", () => {
    expect(
      [0, 1, 2, 3, 4, 5].map((level) => residenceTier(level).floors),
    ).toEqual([3, 3, 5, 5, 5, 5]);
    expect(residenceTier(5).name).toBe("VIP 타워");
    expect([undefined, null, NaN, -1, 8].map(normalizeHouseLevel)).toEqual([
      0, 0, 0, 0, 5,
    ]);
    expect([0, 9, 10, 19, 20, 49, 50, 80].map(houseLevelForPostCount)).toEqual([
      0, 0, 1, 1, 2, 4, 5, 5,
    ]);
  });

  it("게시글 수 10개마다 사용자의 집 레벨을 올릴 수 있다.", () => {
    const user = userFixture();
    const posts = Array.from({ length: 21 }, (_, id) =>
      postFixture({ id, author: { id: user.id, name: user.name } }),
    );
    const home = service.residenceDirectory(user, posts, 20)
      .find((resident) => resident.id === user.id);
    expect(home).toMatchObject({ postCount: 20, level: 2, activityPoints: null });
  });

  it("사용자가 추가되면 글이 없어도 한 채의 집을 생성할 수 있다.", () => {
    const user = userFixture("USER");
    const homes = service.residenceDirectory(user, []);
    expect(homes.filter((home) => home.id === user.id)).toEqual([
      expect.objectContaining({ name: user.name, postCount: 0 }),
    ]);
    const ownPosts = [
      postFixture(),
      postFixture({ id: 2, visibility: "PRIVATE" }),
      postFixture({ id: 3, status: "DRAFT" }),
    ];
    expect(
      service
        .residenceDirectory(user, ownPosts)
        .find((home) => home.id === user.id)?.postCount,
    ).toBe(2);
  });

  it("로그인한 사용자의 집도 이웃 목록에 표시할 수 있다.", () => {
    const user = userFixture("USER");
    const directory = service.residenceDirectory(user, []);
    const neighbors = orderedResidences(directory);
    expect(neighbors.some((home) => home.id === user.id)).toBe(true);
    expect(neighbors.some((home) => home.role === "ADMIN")).toBe(false);
    expect(orderedResidences(directory)).toHaveLength(directory.length);
  });

  it("열 채의 서로 다른 배치를 세 구역마다 반복할 수 있다.", () => {
    const plans = [];
    for (let page = 0; page < 3; page++) {
      const positions = Array.from({ length: 10 }, (_, slot) =>
        residencePosition(page * 10 + slot),
      );
      expect(neighborhoodLayout(page).plots).toHaveLength(10);
      expect(new Set(positions.map((plot) => `${plot.x},${plot.z}`)).size).toBe(
        10,
      );
      expect(positions.filter((point) => point.z < 12)).toHaveLength(5);
      expect(positions.filter((point) => point.z > 12)).toHaveLength(5);
      positions.forEach((position, slot) => {
        const repeated = residencePosition((page + 3) * 10 + slot);
        expect(repeated).toEqual({
          ...position,
          x: position.x + BLOCK_WIDTH * 3,
        });
      });
      plans.push(
        JSON.stringify(
          positions.map(({ x, z }) => ({ x: x - page * BLOCK_WIDTH, z })),
        ),
      );
    }
    expect(new Set(plans).size).toBe(3);
  });

  it.each([0, 1, 2])(
    "%i번 배치에서 모든 집의 현관에 도달하고 다음 구역으로 이동할 수 있다.",
    (page) => {
      const start = RESIDENTIAL_START + page * BLOCK_WIDTH;
      const placements = Array.from({ length: 10 }, (_, slot) =>
        residencePosition(page * 10 + slot),
      );
      // The largest upgrade must still fit every lot and leave the streets accessible.
      const obstacles = placements.map((point) => ({
        x: point.x,
        z: point.z,
        width: 14,
        depth: 11,
      }));
      const busStop = neighborhoodLayout(page).busStop;
      obstacles.push(
        { ...busStop, x: start + busStop.x },
        ...neighborhoodLayout(page).landmarks.map((landmark) => ({
          ...landmark,
          x: start + landmark.x,
        })),
        ...neighborhoodLayout(page).parks.flatMap((park) => {
          const obstacle = parkFeatureObstacle(park);
          return obstacle ? [{ ...obstacle, x: start + obstacle.x }] : [];
        }),
      );
      const bounds = {
        minX: start + 1.5,
        maxX: start + BLOCK_WIDTH - 1.5,
        ...NEIGHBORHOOD_DEPTH,
      };
      for (const [index, plot] of placements.entries()) {
        for (const other of placements.slice(index + 1)) {
          expect(
            Math.abs(plot.x - other.x) >= 16.2 ||
              Math.abs(plot.z - other.z) >= 13.2,
          ).toBe(true);
        }
        for (const street of neighborhoodLayout(page).streets) {
          expect(
            Math.abs(plot.x - start - street.x) >= (14 + street.width) / 2 ||
              Math.abs(plot.z - street.z) >= (11 + street.depth) / 2,
          ).toBe(true);
        }
        const entrance = { x: plot.x, z: plot.entranceZ };
        expect(plot.rotation).toBe(0);
        expect(entrance.z).toBeGreaterThan(plot.z + 5.5);
        const path = findPath(
          { x: start + 50, z: 12 },
          entrance,
          obstacles,
          bounds,
        );
        expect(path.length).toBeGreaterThan(0);
        expect(path[path.length - 1]).toEqual(entrance);
        let previous = { x: start + 50, z: 12 };
        for (const point of path) {
          const steps = Math.ceil(
            Math.hypot(point.x - previous.x, point.z - previous.z) / 0.5,
          );
          for (let step = 0; step <= steps; step++) {
            const t = steps ? step / steps : 0;
            expect(
              canWalk(
                {
                  x: previous.x + (point.x - previous.x) * t,
                  z: previous.z + (point.z - previous.z) * t,
                },
                obstacles,
                bounds,
              ),
            ).toBe(true);
          }
          previous = point;
        }
      }
      for (let x = bounds.minX; x <= bounds.maxX; x += 1)
        expect(canWalk({ x, z: 12 }, obstacles, bounds)).toBe(true);
    },
  );

  it("현재 구역의 양옆을 미리 불러오고 재방문 시 캐시를 사용할 수 있다.", async () => {
    const request = vi.spyOn(service, "fetchNeighborhoodBlock");
    const scope = effectScope();
    const directory = computed(() => service.residenceDirectory(null, Array.from({ length: 50 }, (_, id) =>
      postFixture({ id, author: { id, name: `user-${id}` } }),
    )));
    const neighborhood = scope.run(() => useNeighborhood(directory))!;
    try {
      await flushPromises();
      expect(request).not.toHaveBeenCalled();
      await neighborhood.goToPage(0);
      await flushPromises();
      expect(request.mock.calls.map((call) => call[1])).toEqual([0, 1]);
      expect(neighborhood.visibleBlocks.value[0]?.residents).toHaveLength(10);
      await neighborhood.goToPage(1);
      await flushPromises();
      await neighborhood.goToPage(0);
      expect(request.mock.calls.map((call) => call[1])).toEqual([0, 1, 2]);
      await neighborhood.goToPage(3);
      await flushPromises();
      expect(
        neighborhood.visibleBlocks.value.map((block) => block.page).sort(),
      ).toEqual([2, 3, 4]);
      expect(await neighborhood.goToPage(999)).toBe(false);
      expect(request.mock.calls.map((call) => call[1])).toEqual([0, 1, 2, 3, 4]);
    } finally {
      scope.stop();
    }
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
