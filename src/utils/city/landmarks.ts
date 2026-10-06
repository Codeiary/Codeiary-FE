import * as THREE from "three";
import type { Landmark } from "./neighborhood-layouts";

type MaterialFactory = (
  color: string,
  roughness?: number,
) => THREE.MeshStandardMaterial;

/** Shared, lazily built models follow each district's lifetime and fog materials. */
export function createLandmarks(material: MaterialFactory) {
  const geometries = new Map<string, THREE.BufferGeometry>();
  const models = new Map<Landmark["kind"], THREE.Group>();
  const lights = new Map<
    THREE.MeshStandardMaterial,
    { day: number; night: number }
  >();
  let night = false;

  function geometry(key: string, make: () => THREE.BufferGeometry) {
    if (!geometries.has(key)) geometries.set(key, make());
    return geometries.get(key)!;
  }

  function lit(color: string, day: number, intensity: number) {
    const surface = material(color, 0.45);
    surface.emissive.set(color);
    surface.emissiveIntensity = night ? intensity : day;
    lights.set(surface, { day, night: intensity });
    return surface;
  }

  function mesh(
    parent: THREE.Object3D,
    shape: THREE.BufferGeometry,
    surface: THREE.Material,
    position: number[],
    scale: number[],
  ) {
    const result = new THREE.Mesh(shape, surface);
    result.position.set(position[0]!, position[1]!, position[2]!);
    result.scale.set(scale[0]!, scale[1]!, scale[2]!);
    result.castShadow = true;
    result.receiveShadow = true;
    parent.add(result);
    return result;
  }

  function box(
    parent: THREE.Object3D,
    position: number[],
    scale: number[],
    color: string,
  ) {
    return mesh(
      parent,
      geometry("box", () => new THREE.BoxGeometry()),
      material(color),
      position,
      scale,
    );
  }

  function tapered(
    parent: THREE.Object3D,
    position: number[],
    top: number,
    bottom: number,
    height: number,
    color: string,
    sides = 12,
  ) {
    const key = `cone:${top / bottom}:${sides}`;
    return mesh(
      parent,
      geometry(
        key,
        () => new THREE.CylinderGeometry(top / bottom, 1, 1, sides),
      ),
      material(color),
      position,
      [bottom, height, bottom],
    );
  }

  function limb(
    parent: THREE.Object3D,
    from: number[],
    to: number[],
    radius: number,
    color: string,
  ) {
    const a = new THREE.Vector3(...(from as [number, number, number]));
    const b = new THREE.Vector3(...(to as [number, number, number]));
    const direction = b.clone().sub(a);
    const part = tapered(
      parent,
      a.add(b).multiplyScalar(0.5).toArray(),
      radius * 0.85,
      radius,
      direction.length(),
      color,
    );
    part.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );
    return part;
  }

  function liberty() {
    const group = new THREE.Group();
    const stone = "#c6b59b",
      edge = "#e2d2b5";
    box(group, [0, 0.3, 0], [8, 0.4, 8], stone);
    box(group, [0, 0.7, 0], [7.1, 0.4, 7.1], edge);
    box(group, [0, 2.7, 0], [5.5, 3.6, 5.5], stone);
    box(group, [0, 4.6, 0], [6.1, 0.35, 6.1], edge);
    for (const side of [-1, 1]) {
      for (const offset of [-1.5, 0, 1.5]) {
        box(group, [offset, 2.6, side * 2.77], [0.68, 1.7, 0.06], "#a99b85");
        box(group, [side * 2.77, 2.6, offset], [0.06, 1.7, 0.68], "#a99b85");
      }
    }
    const statue = new THREE.Group();
    statue.position.y = 4.8;
    statue.rotation.y = 0.4;
    group.add(statue);
    const bronze = "#65988a",
      shade = "#4b7e74",
      patina = "#8ab3a1";
    tapered(statue, [0, 3.3, 0], 1.05, 2.25, 6.6, bronze, 10);
    const torso = tapered(statue, [0, 7, 0], 1.45, 1.05, 2.2, bronze, 10);
    torso.scale.z *= 0.65;
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2;
      limb(
        statue,
        [Math.sin(angle) * 0.95, 6.4, Math.cos(angle) * 0.95],
        [Math.sin(angle + 0.16) * 2.1, 0.3, Math.cos(angle + 0.16) * 2.1],
        0.12,
        i % 2 ? patina : shade,
      );
    }
    limb(statue, [-1.15, 7.8, 0.65], [1.3, 5.4, 1.2], 0.32, patina);
    tapered(statue, [0, 8.55, 0], 0.4, 0.5, 0.8, bronze);
    const head = mesh(
      statue,
      geometry("head", () => new THREE.IcosahedronGeometry(1, 1)),
      material(bronze),
      [0, 9.65, 0],
      [0.84, 1.1, 0.75],
    );
    head.rotation.y = 0.05;
    box(statue, [0, 9.6, 0.74], [0.18, 0.38, 0.27], patina);
    box(statue, [-0.3, 9.8, 0.71], [0.26, 0.11, 0.06], shade);
    box(statue, [0.3, 9.8, 0.71], [0.26, 0.11, 0.06], shade);
    tapered(statue, [0, 10.25, 0], 1, 0.96, 0.24, patina);
    // Seven rays frame the face; the raised arm and tablet complete the silhouette.
    for (let i = 0; i < 7; i++) {
      const angle = -Math.PI * 0.46 + (i * Math.PI * 0.92) / 6;
      const spike = tapered(
        statue,
        [Math.sin(angle) * 1.45, 10.15 + Math.cos(angle) * 1.1, 0],
        0,
        0.17,
        1.35,
        patina,
        6,
      );
      spike.rotation.z = -angle;
    }
    limb(statue, [-1.1, 7.7, 0], [-2.35, 10, 0], 0.57, bronze);
    limb(statue, [-2.35, 10, 0], [-2.7, 12.35, 0], 0.39, patina);
    tapered(statue, [-2.7, 12.55, 0], 0.34, 0.38, 0.65, bronze);
    tapered(statue, [-2.7, 13.35, 0], 0.22, 0.28, 1.1, shade);
    tapered(statue, [-2.7, 14.05, 0], 0.73, 0.25, 0.6, "#b69759");
    const flame = mesh(
      statue,
      geometry("flame", () => new THREE.IcosahedronGeometry(1, 1)),
      lit("#e8a450", 0.35, 2),
      [-2.7, 15, 0],
      [0.55, 1.15, 0.5],
    );
    flame.rotation.z = -0.14;
    limb(statue, [1.15, 7.6, 0], [1.95, 6.3, 0.5], 0.5, bronze);
    limb(statue, [1.95, 6.3, 0.5], [1.25, 6.8, 1.2], 0.36, patina);
    const tablet = box(statue, [1.1, 6.9, 1.15], [1.5, 2.2, 0.32], shade);
    tablet.rotation.z = -0.2;
    return group;
  }

  function tower() {
    const group = new THREE.Group();
    box(group, [0, 0.3, 0], [11, 0.4, 11], "#d3ccbc");
    box(group, [0, 0.7, 0], [9.8, 0.4, 9.8], "#e4dcc8");
    box(group, [0, 1.5, 0], [8.8, 1.2, 8.8], "#91aba8");
    // A curved taper and split crown evoke the tower without a heavy imported model.
    const rings = [
      [2, 4.3],
      [7, 4.05],
      [14, 3.55],
      [21, 2.8],
      [27, 1.95],
      [30, 1.4],
    ];
    const facade = geometry("tower", () => {
      const vertices: number[] = [],
        indices: number[] = [];
      for (const [y, radius] of rings) {
        for (let i = 0; i < 16; i++) {
          const angle = (i / 16) * Math.PI * 2;
          vertices.push(
            Math.cos(angle) * radius!,
            y!,
            Math.sin(angle) * radius!,
          );
        }
      }
      for (let level = 0; level < rings.length - 1; level++)
        for (let i = 0; i < 16; i++) {
          const a = level * 16 + i,
            b = level * 16 + ((i + 1) % 16);
          indices.push(a, a + 16, b, b, a + 16, b + 16);
        }
      const shape = new THREE.BufferGeometry();
      shape.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3),
      );
      shape.setIndex(indices);
      shape.computeVertexNormals();
      return shape;
    });
    const glass = material("#7eaaaE", 0.3);
    glass.metalness = 0.3;
    mesh(group, facade, glass, [0, 0, 0], [1, 1, 1]);
    for (let column = 0; column < 16; column++) {
      const angle = (column / 16) * Math.PI * 2;
      for (let segment = 0; segment < rings.length - 1; segment++) {
        const lower = rings[segment]!,
          upper = rings[segment + 1]!;
        limb(
          group,
          [
            Math.cos(angle) * (lower[1]! + 0.025),
            lower[0]!,
            Math.sin(angle) * (lower[1]! + 0.025),
          ],
          [
            Math.cos(angle) * (upper[1]! + 0.025),
            upper[0]!,
            Math.sin(angle) * (upper[1]! + 0.025),
          ],
          column % 4 ? 0.038 : 0.085,
          "#cee0d9",
        );
      }
    }
    const ringGeometry = geometry(
      "ring",
      () => new THREE.TorusGeometry(1, 0.009, 4, 16),
    );
    for (let y = 3; y <= 29; y += 0.8) {
      const upperIndex = rings.findIndex((ring) => ring[0]! >= y);
      const lower = rings[upperIndex - 1]!,
        upper = rings[upperIndex]!;
      const t = (y - lower[0]!) / (upper[0]! - lower[0]!);
      const radius = THREE.MathUtils.lerp(lower[1]!, upper[1]!, t) + 0.035;
      const belt = mesh(
        group,
        ringGeometry,
        y > 25 ? lit("#e8c992", 0, 0.65) : material("#acc6c1"),
        [0, y, 0],
        [radius, radius, radius],
      );
      belt.rotation.x = Math.PI / 2;
    }
    const crown = geometry("crown", () => {
      const shape = new THREE.Shape();
      shape.moveTo(-1.25, 0);
      shape.lineTo(1.25, 0);
      shape.quadraticCurveTo(1.1, 2, 0.23, 4.6);
      shape.lineTo(-0.35, 4);
      shape.lineTo(-1.25, 0);
      const result = new THREE.ExtrudeGeometry(shape, {
        depth: 0.65,
        bevelEnabled: false,
      });
      result.translate(0, 0, -0.325);
      return result;
    });
    for (const side of [-1, 1]) {
      const fin = mesh(
        group,
        crown,
        material("#c1d7d0", 0.35),
        [0, 29.8, side * 0.88],
        [1, 1, 1],
      );
      fin.rotation.y = side < 0 ? Math.PI : 0;
    }
    box(group, [0, 1.5, 4.46], [2, 1.7, 0.1], "#526e72");
    box(group, [0, 2.55, 4.8], [3.6, 0.14, 1.4], "#d6d7bf");
    return group;
  }

  function seoulTower() {
    const group = new THREE.Group();
    const hill = mesh(
      group,
      geometry("hill", () => new THREE.IcosahedronGeometry(1, 1)),
      material("#a0b58d"),
      [0, 0, 0],
      [7, 3.8, 7],
    );
    hill.rotation.y = 0.4;
    tapered(group, [0, 3.4, 0], 3.1, 3.8, 0.7, "#ded5be");
    tapered(group, [0, 12.5, 0], 0.7, 1.3, 18, "#dddccd");
    tapered(group, [0, 21.5, 0], 3.1, 0.8, 2.4, "#ced7ce");
    tapered(group, [0, 23.25, 0], 3.15, 3.15, 1.4, "#557b80");
    tapered(group, [0, 24.1, 0], 3.4, 3.4, 0.3, "#e7dfcc");
    tapered(group, [0, 24.65, 0], 2.7, 3.15, 0.8, "#d4d9cd");
    const halo = mesh(
      group,
      geometry("seoul-halo", () => new THREE.TorusGeometry(3.18, 0.075, 6, 20)),
      lit("#a4c9ce", 0, 1.1),
      [0, 22.6, 0],
      [1, 1, 1],
    );
    halo.rotation.x = Math.PI / 2;
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      tapered(
        group,
        [Math.cos(angle) * 3.16, 23.25, Math.sin(angle) * 3.16],
        0.04,
        0.04,
        1.4,
        "#dae0ce",
      );
    }
    tapered(group, [0, 25.7, 0], 0.8, 1.1, 1.5, "#e3dfcf");
    for (let i = 0; i < 6; i++)
      tapered(
        group,
        [0, 27 + i * 0.85, 0],
        0.28 - i * 0.025,
        0.31 - i * 0.025,
        0.85,
        i % 2 ? "#e2e0d1" : "#b37968",
      );
    return group;
  }

  function tokyoTower() {
    const group = new THREE.Group();
    box(group, [0, 0.35, 0], [11, 0.35, 11], "#d9cebb");
    const red = "#bd604b",
      white = "#eee2cc";
    const levels = [
      [0.7, 4.5],
      [5.5, 3.4],
      [10, 2.2],
      [14, 1.6],
      [19, 1.05],
      [23.5, 0.6],
      [26.5, 0.32],
    ];
    for (const x of [-4.5, 4.5])
      for (const z of [-4.5, 4.5])
        box(group, [x, 0.65, z], [1.6, 0.5, 1.6], "#c4b7a0");
    for (let level = 0; level < levels.length - 1; level++) {
      const [y, radius] = levels[level]!;
      const [upperY, upperRadius] = levels[level + 1]!;
      const color = level === 2 || level === 4 ? white : red;
      for (let face = 0; face < 4; face++) {
        const angle = (face * Math.PI) / 2;
        const transform = (x: number, height: number, z: number) => [
          x * Math.cos(angle) - z * Math.sin(angle),
          height,
          x * Math.sin(angle) + z * Math.cos(angle),
        ];
        limb(
          group,
          transform(-radius!, y!, radius!),
          transform(-upperRadius!, upperY!, upperRadius!),
          0.17,
          color,
        );
        limb(
          group,
          transform(-radius!, y!, radius!),
          transform(upperRadius!, upperY!, upperRadius!),
          0.065,
          color,
        );
        limb(
          group,
          transform(radius!, y!, radius!),
          transform(-upperRadius!, upperY!, upperRadius!),
          0.065,
          color,
        );
        limb(
          group,
          transform(-upperRadius!, upperY!, upperRadius!),
          transform(upperRadius!, upperY!, upperRadius!),
          0.1,
          color,
        );
      }
    }
    for (const [y, size] of [
      [13.2, 4.5],
      [23.6, 2.65],
    ]) {
      box(group, [0, y!, 0], [size!, 1.4, size!], white);
      box(group, [0, y! + 0.82, 0], [size! + 0.45, 0.24, size! + 0.45], red);
      for (const side of [-1, 1]) {
        const window = lit("#d6b783", 0, 0.8);
        mesh(
          group,
          geometry("box", () => new THREE.BoxGeometry()),
          window,
          [0, y!, side * (size! / 2 + 0.02)],
          [size! - 0.45, 0.7, 0.05],
        );
        mesh(
          group,
          geometry("box", () => new THREE.BoxGeometry()),
          window,
          [side * (size! / 2 + 0.02), y!, 0],
          [0.05, 0.7, size! - 0.45],
        );
      }
    }
    for (let i = 0; i < 7; i++)
      tapered(
        group,
        [0, 27 + i * 0.85, 0],
        0.25 - i * 0.025,
        0.28 - i * 0.025,
        0.85,
        i % 2 ? white : red,
      );
    return group;
  }

  function torii() {
    const group = new THREE.Group();
    box(group, [0, 0.3, 0], [8, 0.3, 6], "#d9cbb2");
    for (const side of [-1, 1]) {
      tapered(group, [side * 2.65, 0.65, 0], 0.65, 0.7, 0.45, "#6b6b5b");
      const pillar = tapered(
        group,
        [side * 2.6, 3.45, 0],
        0.29,
        0.38,
        5.7,
        "#b76a52",
      );
      pillar.rotation.z = side * 0.035;
    }
    box(group, [0, 4.9, 0], [7, 0.35, 0.4], "#b76a52");
    box(group, [0, 5.6, 0], [0.38, 1.2, 0.4], "#b76a52");
    box(group, [0, 6.3, 0], [7.7, 0.48, 0.85], "#b76a52");
    box(group, [0, 6.61, 0], [8.1, 0.18, 1.05], "#555e55");
    for (const side of [-1, 1]) {
      const tip = box(
        group,
        [side * 3.8, 6.7, 0],
        [1.15, 0.2, 1.05],
        "#555e55",
      );
      tip.rotation.z = side * 0.15;
    }
    return group;
  }

  const builders: Record<Landmark["kind"], () => THREE.Group> = {
    liberty,
    tower,
    "seoul-tower": seoulTower,
    "tokyo-tower": tokyoTower,
    torii,
  };

  return {
    add(parent: THREE.Object3D, landmark: Landmark, start: number) {
      if (!models.has(landmark.kind))
        models.set(landmark.kind, builders[landmark.kind]());
      const model = models.get(landmark.kind)!.clone(true);
      model.position.set(start + landmark.x, 0.3, landmark.z);
      parent.add(model);
    },
    setNight(value: boolean) {
      night = value;
      lights.forEach((level, surface) => {
        surface.emissiveIntensity = value ? level.night : level.day;
      });
    },
    dispose() {
      geometries.forEach((shape) => shape.dispose());
      geometries.clear();
      models.clear();
      lights.clear();
    },
  };
}
