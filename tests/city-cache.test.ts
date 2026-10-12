import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCity, type CityController } from "@/utils/city/world";
import { createResidenceModels } from "@/utils/city/residence-model";
import type { NeighborhoodBlock } from "@/services/neighborhood";

const render = vi.hoisted(() => vi.fn());
vi.mock("three", async (original) => ({
  ...await original<typeof import("three")>(),
  WebGLRenderer: class {
    shadowMap = { enabled: false, type: 0 };
    capabilities = { getMaxAnisotropy: () => 1 };
    setPixelRatio() {}
    setSize() {}
    render = render;
    dispose() {}
    forceContextLoss() {}
  },
}));

let city: CityController | undefined;
beforeEach(() => {
  render.mockClear();
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const noop = () => {};
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    fillRect: noop, fillText: noop, strokeText: noop, save: noop, restore: noop,
    beginPath: noop, roundRect: noop, clip: noop, clearRect: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    measureText: () => ({ width: 100 }),
  } as unknown as CanvasRenderingContext2D);
});
afterEach(() => {
  city?.dispose();
  city = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function block(page: number): NeighborhoodBlock {
  return {
    page, total: 100, hasNext: page < 9,
    residents: Array.from({ length: 10 }, (_, slot) => ({
      id: page * 10 + slot, name: `이웃 ${page * 10 + slot}`, role: "USER",
      postCount: 0, level: 0, activityPoints: null, activity: 0,
    })),
  };
}
function initialize() {
  const canvas = document.createElement("canvas");
  vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
    width: 1280, height: 800, x: 0, y: 0, top: 0, left: 0, right: 1280, bottom: 800,
    toJSON() {},
  });
  city = createCity(canvas, {
    labels() {}, enter() {}, travelling() {}, ready() {}, near() {}, residenceLabels() {},
    enterResidence() {}, travellingResidence() {}, requestDistrict() {}, districtChanged() {},
  });
  city.setPaused(true);
  return render.mock.lastCall![0] as THREE.Scene;
}
function district(scene: THREE.Scene, page: number) {
  return scene.children.find((group) =>
    group.children.some((house) => house.userData.residenceIndex === page * 10));
}

describe("이웃 맵 재사용", () => {
  it("같은 레벨과 색상의 건물은 모델을 재사용하고 각 집의 변환은 독립적으로 유지할 수 있다.", () => {
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial();
    const shape = vi.fn((parent: THREE.Object3D) => {
      const mesh = new THREE.Mesh(geometry, material);
      parent.add(mesh);
      return mesh;
    });
    const models = createResidenceModels({ box: shape, cylinder: shape, sphere: shape });
    const first = models.build(0, "#bc9984");
    const calls = shape.mock.calls.length;
    const second = models.build(0, "#bc9984");
    expect(shape).toHaveBeenCalledTimes(calls);
    expect(first.house).not.toBe(second.house);
    const mesh = first.house.children[0] as THREE.InstancedMesh;
    const other = second.house.children[0] as THREE.InstancedMesh;
    expect(mesh.instanceMatrix).not.toBe(other.instanceMatrix);
    models.build(1, "#bc9984");
    expect(shape.mock.calls.length).toBeGreaterThan(calls);
    geometry.dispose();
    material.dispose();
  });

  it("최근 방문한 맵과 프로필만 바뀐 맵은 재사용하고 레벨이 바뀐 구역만 갱신할 수 있다.", () => {
    const scene = initialize();
    const first = block(0);
    city!.setNeighborhood([first, block(1)], 100);
    const original = district(scene, 0)!;
    city!.setNeighborhood([block(2), block(3), block(4)], 100);
    expect(original.visible).toBe(false);
    const updated = { ...first, residents: first.residents.map((resident) => ({
      ...resident, name: "변경된 닉네임",
    })) };
    city!.setNeighborhood([updated, block(1)], 100);
    expect(district(scene, 0)).toBe(original);
    expect(original.visible).toBe(true);
    const sibling = district(scene, 1);
    city!.setNeighborhood([{ ...updated, residents: updated.residents.map((resident, slot) =>
      slot ? resident : { ...resident, level: 1 }) }, block(1)], 100);
    expect(district(scene, 0)).not.toBe(original);
    expect(district(scene, 1)).toBe(sibling);
  });

  it("오래된 구역을 제거해 최대 다섯 구역만 보관하고 종료 시 숨겨진 맵도 해제할 수 있다.", () => {
    const scene = initialize();
    const disposeInstances = vi.spyOn(THREE.InstancedMesh.prototype, "dispose");
    const disposeGeometry = vi.spyOn(THREE.BufferGeometry.prototype, "dispose");
    for (let page = 1; page < 8; page++)
      city!.setNeighborhood([block(page - 1), block(page), block(page + 1)], 100);
    const retained = scene.children.filter((group) => group.children.some((house) =>
      house.userData.residenceIndex !== undefined));
    expect(retained).toHaveLength(5);
    expect(retained.filter((group) => group.visible)).toHaveLength(3);
    expect(district(scene, 0)).toBeUndefined();
    expect(disposeInstances).toHaveBeenCalled();
    expect(disposeGeometry).not.toHaveBeenCalled();
    const instanceCount = disposeInstances.mock.calls.length;
    city!.dispose();
    city = undefined;
    expect(disposeInstances.mock.calls.length).toBeGreaterThan(instanceCount);
    expect(disposeGeometry).toHaveBeenCalled();
  });
});
