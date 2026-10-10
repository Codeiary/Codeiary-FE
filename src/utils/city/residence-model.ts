import * as THREE from "three";
import { residenceTier, type HouseLevel } from "./residence-tiers";
import { instanceStaticMeshes } from "./static-meshes";

interface Shapes {
  box: (
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    color: string,
    cast?: boolean,
  ) => THREE.Mesh;
  cylinder: (
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    radius: number,
    height: number,
    color: string,
  ) => THREE.Mesh;
  sphere: (
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    scale: number,
    color: string,
  ) => THREE.Mesh;
}

/** Main and streamed homes use exactly the same tier geometry. Only paint varies. */
export function createResidenceModels({ box, cylinder, sphere }: Shapes) {
  function build(level: HouseLevel, facade: string) {
    const tier = residenceTier(level);
    const { width, height, depth, floors } = tier;
    const house = new THREE.Group();
    const trim = "#ece2ce";
    const metal = level === 5 ? "#bd9c62" : "#73857d";
    const stone = level >= 3 ? "#d8ccb4" : "#c7beaa";

    box(house, 0, height / 2, 0, width, height, depth, facade);
    box(house, 0, 0.3, 0, width + 0.4, 0.6, depth + 0.4, stone);
    box(house, 0, height + 0.15, 0, width + 0.5, 0.3, depth + 0.5, trim);
    for (const side of [-1, 1]) {
      box(
        house,
        (side * width) / 2,
        height + 0.55,
        0,
        0.22,
        0.7,
        depth,
        facade,
      );
      box(
        house,
        0,
        height + 0.55,
        (side * depth) / 2,
        width,
        0.7,
        0.22,
        facade,
      );
    }
    for (let floor = 0; floor < floors; floor++) {
      const y = 2.4 + floor * 3.2;
      for (const side of [-1, 1]) {
        for (const x of [-width * 0.29, 0, width * 0.29]) {
          if (floor === 0 && side === 1 && x === 0) continue;
          const frame = level >= 1;
          if (frame)
            box(house, x, y, side * 5.55, 2.3, 2.35, 0.12, trim, false);
          box(house, x, y, side * 5.64, 1.95, 1.95, 0.08, "#526e72", false);
          if (level >= 3) {
            box(house, x, y, side * 5.7, 0.08, 2, 0.06, metal, false);
            box(house, x, y - 1.1, side * 5.75, 2.5, 0.16, 0.4, trim, false);
          }
        }
        for (const z of [-3.3, 0, 3.3]) {
          if (level >= 1)
            box(
              house,
              side * (width / 2 + 0.06),
              y,
              z,
              0.12,
              2.35,
              2.3,
              trim,
              false,
            );
          box(
            house,
            side * (width / 2 + 0.14),
            y,
            z,
            0.08,
            1.95,
            1.95,
            "#526e72",
            false,
          );
        }
      }
      if (level >= 2 && floor > 0) {
        for (const side of [-1, 1]) {
          box(
            house,
            0,
            y - 1.55,
            side * 5.56,
            width + 0.2,
            0.14,
            0.2,
            trim,
            false,
          );
          box(
            house,
            side * (width / 2 + 0.05),
            y - 1.55,
            0,
            0.16,
            0.14,
            depth,
            trim,
            false,
          );
        }
      }
    }
    // Every tier shares the same clear, south-facing entrance and navigation footprint.
    box(house, 0, 1.9, 5.64, 2.5, 3.5, 0.16, "#526e72");
    box(house, 0, 1.9, 5.77, 0.09, 3.5, 0.07, level >= 3 ? metal : trim, false);
    box(house, 0, 0.1, 6.25, 4, 0.2, 1.5, stone);
    box(
      house,
      0,
      3.85,
      6.2,
      level >= 3 ? 8 : 4,
      0.22,
      1.6,
      level >= 3 ? metal : trim,
    );

    function planter(x: number, y: number, z: number, size = 1) {
      box(house, x, y + 0.25, z, size * 1.5, 0.5, size, stone);
      for (const dx of [-0.35, 0.35])
        sphere(house, x + dx * size, y + 0.75, z, 0.48 * size, "#8caa7e");
    }
    function gardenBed(x: number, z: number, width: number) {
      box(house, x, 0.2, z, width, 0.4, 1.1, stone);
      for (const offset of [-0.3, 0, 0.3])
        sphere(house, x + offset * width, 0.72, z, 0.34, "#8caa7e");
    }
    function gardenLamp(x: number, z: number) {
      cylinder(house, x, 0.75, z, 0.08, 1.5, metal);
      sphere(house, x, 1.58, z, 0.22, "#e7d8b7");
    }
    function courtyardFountain(x: number, z: number) {
      cylinder(house, x, 0.18, z, 1.2, 0.3, stone);
      cylinder(house, x, 0.48, z, 0.72, 0.45, metal);
      cylinder(house, x, 0.86, z, 0.28, 0.45, stone);
      sphere(house, x, 1.18, z, 0.28, "#8bbdb7");
    }
    function gardenBench(x: number, z: number) {
      box(house, x, 0.62, z, 2.2, 0.18, 0.65, trim);
      box(house, x, 1.08, z - 0.24, 2.2, 0.72, 0.14, stone);
      for (const side of [-1, 1])
        box(house, x + side * 0.72, 0.3, z, 0.14, 0.6, 0.18, metal);
    }
    function pergola(x: number, z: number, span: number) {
      for (const dx of [-span / 2, span / 2])
        for (const dz of [-1.6, 1.6])
          box(house, x + dx, height + 1.3, z + dz, 0.13, 2, 0.13, metal);
      for (let dz = -1.8; dz <= 1.8; dz += 0.6)
        box(house, x, height + 2.3, z + dz, span + 0.5, 0.18, 0.22, metal);
    }
    function balcony(y: number, span: number) {
      box(house, 0, y, 6.15, span, 0.18, 1.4, trim);
      box(house, 0, y + 0.9, 6.83, span, 0.1, 0.1, metal);
      for (let x = -span / 2; x <= span / 2; x += 0.8)
        box(house, x, y + 0.45, 6.83, 0.06, 0.85, 0.06, metal, false);
      for (const side of [-1, 1])
        box(
          house,
          (side * span) / 2,
          y + 0.9,
          6.2,
          0.1,
          0.1,
          1.3,
          metal,
          false,
        );
    }
    function rooftopPool() {
      box(house, -2.65, height + 0.55, -0.5, 5, 0.45, 6.8, trim);
      box(
        house,
        -2.65,
        height + 0.79,
        -0.5,
        4.35,
        0.06,
        6.15,
        "#8bbdb7",
        false,
      );
      for (const z of [-2.7, 1.7]) {
        box(house, 1.4, height + 0.7, z, 1.05, 0.18, 2.1, "#d2ba93");
        const back = box(
          house,
          1.4,
          height + 0.93,
          z - 0.62,
          1.05,
          0.14,
          0.75,
          "#e7d8b7",
        );
        back.rotation.x = -0.45;
      }
    }

    if (level === 0) {
      box(house, -1.8, height + 0.85, -1.2, 2.6, 1, 2.1, "#b1b9ac");
      for (let x = -2.7; x <= -0.8; x += 0.45)
        box(house, x, height + 1.38, -1.2, 0.08, 0.06, 1.6, metal, false);
    }
    if (level === 2) {
      // A visible stair tower gives the first five-floor upgrade a new skyline.
      box(house, 0, height + 1.5, -1.2, 4.8, 3, 4.2, facade);
      box(house, 0, height + 3.08, -1.2, 5.4, 0.2, 4.8, trim);
      box(house, 0, height + 1.65, 1.02, 2.5, 2.1, 0.08, "#526e72", false);
      for (const side of [-1, 1])
        box(house, side * (width / 2 - 0.2), height / 2, 5.65, 0.3, height, 0.3, trim);
    }
    if (level === 1) {
      pergola(-1.3, -1, 5.7);
      for (const x of [-3.7, 3.7]) planter(x, 0.2, 6.15);
      planter(3.8, height + 0.35, 2.8, 1.4);
      balcony(4.25, 7.8);
    }
    if (level >= 2) {
      // A paved walk and planted borders grow with the house, keeping the doorway clear.
      box(house, 0, 0.12, 8.45, 2.35, 0.16, 4.2, trim, false);
      for (const x of [-6.35, 6.35]) gardenBed(x, 8.6, 1.35);
    }
    if (level >= 3) {
      for (const x of [-3.5, 3.5]) gardenLamp(x, 9.2);
      for (const x of [-6.35, 6.35]) gardenBed(x, 5.9, 1.35);
    }
    if (level >= 4) {
      gardenBench(4.9, 7.1);
      for (const x of [-5.2, 5.2]) planter(x, 0.2, 10.3, 1.15);
    }
    if (level === 5) {
      courtyardFountain(4.8, 10.2);
      for (const x of [-6.35, 6.35]) gardenLamp(x, 10.2);
    }
    if (level >= 3) {
      for (const x of [-width / 2 + 0.25, width / 2 - 0.25])
        box(house, x, height / 2, 5.7, 0.48, height, 0.5, stone);
      for (const x of [-3.5, 3.5]) {
        cylinder(house, x, 1.95, 6.25, 0.16, 3.8, metal);
        planter(x + Math.sign(x) * 1.6, 0.2, 6.2);
      }
      for (let floor = 1; floor < floors; floor++)
        if (level >= 4 || floor % 2 === 1)
          balcony(1.25 + floor * 3.2, width - 1);
      box(house, 0, height - 0.35, 5.72, width + 0.6, 0.32, 0.5, trim);
    }
    if (level === 3) {
      pergola(-2, -1, 5.4);
      for (const z of [-3.5, 3.5]) planter(3.7, height + 0.35, z, 1.6);
      // A broad portico and paired corner piers make the luxury tier read at street level.
      box(house, 0, 4.35, 6.35, 10.5, 0.4, 2.4, metal);
      for (const x of [-4.8, 4.8])
        box(house, x, 2.75, 6.55, 0.42, 5.2, 0.42, stone);
      box(house, 2.7, height + 0.6, 0, 2.4, 0.5, 2, "#c2b394");
    }
    if (level === 4) {
      rooftopPool();
      pergola(4.4, -0.5, 2.8);
      for (const x of [-4.5, 4.5]) planter(x, height + 0.35, 4.2, 1.3);
      for (const x of [-width / 2 + 1.1, width / 2 - 1.1])
        box(house, x, height / 2, -5.65, 0.28, height, 0.25, metal);
      // The premium tier adds a full penthouse volume above its rooftop amenities.
      box(house, 3.45, height + 1.55, -1.55, 5.8, 3.1, 4.8, facade);
      box(house, 3.45, height + 1.65, 0.9, 4.8, 2.15, 0.08, "#526e72", false);
      for (const x of [1.4, 3.45, 5.5])
        box(house, x, height + 1.65, 0.98, 0.1, 2.4, 0.1, metal, false);
      box(house, 3.45, height + 3.2, -1.55, 6.4, 0.22, 5.3, metal);
    }
    if (level === 5) {
      // A taller penthouse, roof pool and crown make the VIP silhouette unmistakable.
      box(house, -3.5, height + 0.6, -0.8, 4.8, 0.45, 6.6, trim);
      box(house, -3.5, height + 0.85, -0.8, 4.2, 0.06, 6, "#8bbdb7", false);
      box(house, 2.8, height + 1.9, -0.4, 5.8, 3.2, 6.4, facade);
      box(house, 2.8, height + 1.9, 2.86, 5.2, 2.5, 0.08, "#526e72", false);
      box(house, 5.76, height + 1.9, -0.4, 0.08, 2.5, 5.7, "#526e72", false);
      box(house, 2.8, height + 3.65, -0.4, 6.4, 0.3, 7, metal);
      for (const x of [0.4, 2.8, 5.2])
        box(house, x, height + 1.9, 2.95, 0.13, 2.7, 0.12, metal, false);
      for (const x of [-3.8, 3.8]) {
        box(house, x, height + 2.2, -0.8, 0.18, 4.4, 0.18, metal);
        box(house, x, height + 4.45, -0.8, 1.2, 0.18, 0.18, metal);
      }
      box(house, 2.8, height + 3.65, -0.4, 6.9, 0.32, 7.4, metal);
      box(house, 2.8, height + 4.15, -0.4, 3.3, 0.55, 3.5, facade);

      for (const x of [-4.7, 4.7]) planter(x, height + 0.4, 4.25, 1.35);
      const crest = box(house, 0, 4.1, 7.07, 0.65, 0.65, 0.12, metal);
      crest.rotation.z = Math.PI / 4;
      for (const side of [-1, 1]) {
        box(
          house,
          side * (width / 2 + 0.25),
          height / 2,
          -2.1,
          0.16,
          height,
          0.3,
          metal,
        );
        box(
          house,
          side * (width / 2 + 0.25),
          height / 2,
          2.1,
          0.16,
          height,
          0.3,
          metal,
        );
      }
    }
    house.userData.houseLevel = level;
    instanceStaticMeshes(house);
    return { house, tier, labelHeight: height + tier.roofHeight };
  }
  return { build };
}
