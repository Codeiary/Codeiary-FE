import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { canWalk, findPath, type Point, type Obstacle } from "./navigation";
import { places, type Destination } from "./places";
export interface CityHandlers {
  position: (point: Point) => void;
  labels: (
    positions: { id: Destination; x: number; y: number; visible: boolean }[],
  ) => void;
  enter: (id: Destination) => void;
  travelling: (id: Destination) => void;
  ready: () => void;
  near: (id: Destination | null) => void;
}
export interface CityController {
  visit: (id: Destination) => boolean;
  setNight: (night: boolean) => void;
  resetCamera: () => void;
  setInput: (key: string, pressed: boolean) => void;
  setPaused: (paused: boolean) => void;
  interact: () => void;
  dispose: () => void;
}

export function createCity(
  canvas: HTMLCanvasElement,
  handlers: CityHandlers,
): CityController {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog("#e8e4d9", 170, 290);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  const camera = new THREE.OrthographicCamera(-70, 70, 45, -45, 0.1, 400);
  const initialTarget = new THREE.Vector3(-9, 0, 1);
  const viewTarget = initialTarget.clone();
  camera.position.copy(initialTarget).add(new THREE.Vector3(78, 88, 100));
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(initialTarget);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minZoom = 0.7;
  controls.maxZoom = 1.65;
  camera.zoom = controls.minZoom;
  camera.updateProjectionMatrix();
  controls.minPolarAngle = Math.PI / 6;
  controls.maxPolarAngle = Math.PI / 2.65;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE,
  };
  controls.update();

  const hemi = new THREE.HemisphereLight("#f9f1df", "#779393", 2.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff0d6", 3.4);
  sun.position.set(-35, 70, 35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -80,
    right: 80,
    top: 80,
    bottom: -80,
    near: 1,
    far: 170,
  });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.15;
  sun.shadow.radius = 3;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#cfdeef", 0.7);
  fill.position.set(50, 20, -60);
  scene.add(fill);

  const mats = new Map<string, THREE.MeshStandardMaterial>();
  function material(color: string, roughness = 0.9) {
    const k = color + roughness;
    if (!mats.has(k))
      mats.set(k, new THREE.MeshStandardMaterial({ color, roughness }));
    return mats.get(k)!;
  }
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
  const unitSphere = new THREE.IcosahedronGeometry(1, 1);
  function box(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    cast = true,
  ) {
    const mesh = new THREE.Mesh(unitBox, material(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function cylinder(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    color: string,
  ) {
    const mesh = new THREE.Mesh(unitCylinder, material(color));
    mesh.position.set(x, y, z);
    mesh.scale.set(r, h, r);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function sphere(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    scale: number,
    color: string,
  ) {
    const mesh = new THREE.Mesh(unitSphere, material(color));
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(scale);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function sign(
    parent: THREE.Object3D,
    text: string,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    bg: string,
    fg: string,
    rotation = 0,
  ) {
    const bitmap = document.createElement("canvas");
    bitmap.width = 768;
    bitmap.height = 256;
    const ctx = bitmap.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 768, 256);
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const rows = text.split("\n");
    ctx.font = `800 ${rows.length > 1 ? 78 : 78}px Arial, sans-serif`;
    rows.forEach((row, i) =>
      ctx.fillText(row, 384, 128 + (i - (rows.length - 1) / 2) * 92, 716),
    );
    const texture = new THREE.CanvasTexture(bitmap);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotation;
    parent.add(mesh);
    return mesh;
  }

  const obstacles: Obstacle[] = [];
  const land = new THREE.Group();
  scene.add(land);
  // Continue the streets beyond the frame, instead of showing an isolated island.
  box(land, -66, -1.4, -3, 232, 2.8, 240, "#c6bba3", false);
  box(land, -66, 0.02, -3, 232, 0.12, 240, "#c5ceb3", false);
  box(land, -5, 0.12, -12, 87, 0.2, 67, "#e7dfcb", false);
  // A waterfront, boardwalk, and tiled sidewalks give the city a real sense of place.
  const waterMat = new THREE.MeshStandardMaterial({
    color: "#7cb9ba",
    roughness: 0.3,
    metalness: 0.16,
  });
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 320, 16, 40),
    waterMat,
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(130, -1.4, -9);
  scene.add(water);
  box(land, 46, 0.05, -2, 7.5, 0.3, 240, "#d8c6a3", false);
  for (let z = -118; z < 118; z += 2.1)
    box(land, 46, 0.23, z, 7.4, 0.035, 0.08, "#baa988", false);
  for (let z = -116; z < 116; z += 4.3) {
    box(land, 49.6, 0.95, z, 0.22, 1.8, 0.22, "#f2eee0");
    box(land, 49.6, 1.5, z + 2, 0.18, 0.18, 4.3, "#f2eee0");
  }
  for (let i = 0; i < 30; i++)
    box(
      land,
      56 + (i % 5) * 5,
      -1.32,
      -44 + Math.floor(i / 5) * 16,
      2.5,
      0.02,
      0.1,
      "#c5dddd",
      false,
    );
  const roadColor = "#637879";
  box(land, -66, 0.26, 12, 232, 0.14, 8.5, roadColor, false);
  box(land, 14, 0.27, -3, 8.5, 0.14, 240, roadColor, false);
  box(land, -66, 0.22, 6.5, 232, 0.3, 2.4, "#eee8d9", false);
  box(land, -66, 0.22, 17.5, 232, 0.3, 2.4, "#eee8d9", false);
  box(land, 8.5, 0.22, -3, 2.4, 0.3, 240, "#eee8d9", false);
  box(land, 19.5, 0.22, -3, 2.4, 0.3, 240, "#eee8d9", false);
  for (let x = -179; x < 48; x += 5)
    if (Math.abs(x - 14) > 7)
      box(land, x, 0.345, 12, 2.6, 0.02, 0.13, "#eddfb7", false);
  for (let z = -117; z < 115; z += 5)
    if (Math.abs(z - 12) > 7)
      box(land, 14, 0.36, z, 0.13, 0.02, 2.6, "#eddfb7", false);
  // Zebra crossings at the intersection.
  for (let i = 0; i < 8; i++) {
    const offset = i * 0.92 - 3.2;
    box(land, 7.5, 0.36, 12 + offset, 2, 0.02, 0.5, "#e9e7db", false);
    box(land, 20.5, 0.36, 12 + offset, 2, 0.02, 0.5, "#e9e7db", false);
    box(land, 14 + offset, 0.37, 5.5, 0.5, 0.02, 2, "#e9e7db", false);
    box(land, 14 + offset, 0.37, 18.5, 0.5, 0.02, 2, "#e9e7db", false);
  }
  for (let x = -46; x < 45; x += 3)
    for (const z of [6.3, 17.7])
      box(land, x, 0.385, z, 0.035, 0.02, 2, "#d5cfbf", false);
  for (let z = -43; z < 40; z += 3)
    for (const x of [8.3, 19.7])
      box(land, x, 0.385, z, 2, 0.02, 0.035, "#d5cfbf", false);

  function windows(
    parent: THREE.Object3D,
    width: number,
    depth: number,
    floors: number,
    color = "#526e72",
    start = 3,
    step = 3.2,
  ) {
    for (let row = 0; row < floors; row++) {
      const y = start + row * step;
      for (let x = -width / 2 + 2; x < width / 2 - 1; x += 3) {
        box(parent, x, y, depth / 2 + 0.035, 1.8, 1.9, 0.09, color, false);
        box(
          parent,
          x,
          y - 1,
          depth / 2 + 0.15,
          2.1,
          0.17,
          0.35,
          "#f4e7cf",
          false,
        );
      }
      for (let z = -depth / 2 + 2; z < depth / 2 - 1; z += 3)
        box(parent, width / 2 + 0.035, y, z, 0.09, 1.9, 1.8, color, false);
    }
  }
  function building(
    x: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    floors: number,
  ) {
    const group = new THREE.Group();
    group.position.set(x, 0.3, z);
    scene.add(group);
    box(group, 0, h / 2, 0, w, h, d, color);
    box(group, 0, h + 0.15, 0, w + 0.6, 0.4, d + 0.6, "#f0e5d1");
    box(group, 0, 0.4, 0, w + 0.4, 0.6, d + 0.4, "#d7cbb5");
    windows(group, w, d, floors);
    // Rooftop parapets and AC units.
    box(group, 0, h + 0.6, -d / 2, w, 0.9, 0.2, color);
    box(group, -w / 2, h + 0.6, 0, 0.2, 0.9, d, color);
    box(group, 0, h + 0.8, -1, 2.7, 1.1, 2.1, "#b7b9af");
    for (let i = 0; i < 4; i++)
      box(
        group,
        -0.9 + i * 0.6,
        h + 1.4,
        -1,
        0.25,
        0.07,
        1.5,
        "#88928b",
        false,
      );
    obstacles.push({ x, z, width: w, depth: d });
    return group;
  }

  // Each landmark has its own silhouette, palette, signage, and open doorway.
  const blog = building(-18, -6, 15, 9.8, 11, "#dc8168", 2);
  blog.userData.destination = "blog";
  box(blog, 0, 3, 5.6, 4.1, 5.5, 0.2, "#eee3cf");
  box(blog, 0, 2.7, 5.8, 2.4, 4.7, 0.2, "#3d6667");
  box(blog, 0, 2.7, 5.97, 0.1, 4.7, 0.06, "#d2c7ac");
  box(blog, 0, 5.2, 7, 10.6, 0.3, 3.4, "#f6dfbd");
  for (let i = 0; i < 10; i++)
    box(blog, -4.8 + i * 1.05, 5.38, 7, 0.5, 0.07, 3.4, "#d76750", false);
  cylinder(blog, -4.8, 2.55, 8, 0.09, 5, "#f4e8cf");
  cylinder(blog, 4.8, 2.55, 8, 0.09, 5, "#f4e8cf");
  sign(blog, "THE BLOG HOUSE", 0, 8.3, 5.6, 12, 1.65, "#dc8168", "#fff1d7");
  box(blog, 0, 10.1, 0, 16, 0.35, 12, "#f1dcc2");
  sign(blog, "HELLO, WORLD.", 0, 11.9, 0, 10, 2, "#f3e9d5", "#ad624d");
  box(blog, -4, 10.9, 0, 0.1, 1.8, 0.1, "#736a5b");
  box(blog, 4, 10.9, 0, 0.1, 1.8, 0.1, "#736a5b");
  box(blog, 0, 0.1, 6.8, 6.5, 0.2, 2.8, "#e9d7bb");

  const gallery = building(5, -28, 15, 13.5, 12, "#428e86", 3);
  gallery.userData.destination = "portfolio";
  box(gallery, 0, 2.8, 6.13, 12, 4.5, 0.13, "#6bb4ad");
  for (const x of [-6, -2, 2, 6])
    box(gallery, x, 2.8, 6.27, 0.18, 4.8, 0.16, "#dde7cf");
  box(gallery, 0, 5.5, 7.2, 16.5, 0.45, 3.4, "#efe7d2");
  sign(gallery, "THE GALLERY", 0, 11.8, 6.1, 12, 1.5, "#428e86", "#f5ebd6");
  box(gallery, 0, 14.2, 0, 11, 0.8, 8, "#b5c2a2");
  const sculpture = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.55, 8, 24),
    material("#f0d5a8"),
  );
  sculpture.position.set(0, 17, 0);
  sculpture.rotation.set(0.2, 0.35, 0.2);
  sculpture.castShadow = true;
  gallery.add(sculpture);
  box(gallery, 0, 14.9, 0, 2, 0.8, 2, "#e6dec9");
  box(gallery, 0, 0.1, 7.5, 12, 0.2, 3, "#dfd3b8");

  const news = building(30, -10, 13, 20, 13, "#deb45a", 5);
  news.userData.destination = "news";
  box(news, -4.5, 10, 6.7, 0.32, 19.4, 0.3, "#f3dfac");
  box(news, 4.5, 10, 6.7, 0.32, 19.4, 0.3, "#f3dfac");
  box(news, 0, 2.2, 6.75, 3.5, 4.1, 0.14, "#456970");
  box(news, 0, 4.9, 7.6, 8.2, 0.4, 2.5, "#f6e9c7");
  sign(news, "DAILY BYTE", 0, 18.4, 6.6, 10.6, 1.7, "#deb45a", "#635933");
  box(news, 0, 20.7, 0, 9, 1.1, 9, "#ead7aa");
  cylinder(news, 0, 23.2, 0, 0.12, 4.5, "#6f7567");
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(1.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    material("#eee6cd"),
  );
  dish.position.set(0.7, 23.1, 0);
  dish.rotation.z = -0.6;
  news.add(dish);

  // Smaller neighborhood buildings frame the three destinations.
  const cafe = building(-36, -7, 11, 5.5, 12, "#ddd0b2", 1);
  sign(cafe, "SLOW COFFEE", 0, 4.5, 6.1, 9, 1.3, "#3d685e", "#f3ead6");
  box(cafe, 0, 3.1, 7, 11.7, 0.2, 2.5, "#64846e");
  const homes = [
    [-38, -28, 12, 13, 11, "#c1b5a2", 3],
    [-23, -29, 13, 17, 12, "#e0bd9f", 4],
    [-9, -41, 10, 16, 9, "#aec1b5", 4],
    [29, -34, 15, 15, 11, "#a8bcb7", 3],
    [-37, 29, 13, 7, 11, "#e7d8b9", 1],
    [-19, 30, 12, 9, 11, "#bc9984", 2],
    [32, 30, 15, 9, 10, "#d5c4ad", 2],
    [-58, -8, 12, 10, 13, "#d5c5aa", 2],
    [-58, -31, 12, 14, 12, "#b8c3ad", 3],
    [-40, 49, 14, 9, 12, "#c6a58a", 2],
    [-22, 50, 12, 12, 12, "#b5c3ad", 3],
    [-4, 50, 12, 9, 11, "#d2bc90", 2],
    [33, 50, 15, 8, 11, "#b6c3b5", 2],
    [-37, -55, 12, 16, 12, "#c4b6a3", 4],
    [-17, -58, 14, 13, 12, "#c7c6b5", 3],
    [5, -56, 15, 15, 12, "#b1c0b4", 3],
  ] as const;
  for (const [x, z, w, h, d, color, floors] of homes)
    building(x, z, w, h, d, color, floors);
  const cornerShop = building(-3, 31, 12, 5.3, 10, "#b6c4b1", 1);
  sign(
    cornerShop,
    "RECORDS & MORE",
    0,
    4.5,
    5.1,
    10,
    1.15,
    "#587a69",
    "#f5ecd5",
  );
  const billboard = new THREE.Group();
  billboard.position.set(-28, 0, -44);
  scene.add(billboard);
  box(billboard, -5, 12, 0, 0.5, 24, 0.5, "#7e887a");
  box(billboard, 5, 12, 0, 0.5, 24, 0.5, "#7e887a");
  box(billboard, 0, 23, -0.1, 17, 8.5, 0.4, "#607a6d");
  sign(
    billboard,
    "STAY CURIOUS.\nKEEP BUILDING.",
    0,
    23,
    0.13,
    16.5,
    8,
    "#607a6d",
    "#f6e7cb",
  );

  function palm(x: number, z: number, scale = 1) {
    const tree = new THREE.Group();
    tree.position.set(x, 0.3, z);
    tree.scale.setScalar(scale);
    scene.add(tree);
    const trunk = cylinder(tree, 0.3, 4, 0, 0.23, 8, "#ab8a60");
    trunk.rotation.z = -0.07;
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const points = [
        new THREE.Vector3(0.5, 8, 0),
        new THREE.Vector3(Math.cos(angle) * 2 + 0.5, 9.1, Math.sin(angle) * 2),
        new THREE.Vector3(
          Math.cos(angle) * 4.2 + 0.5,
          6.9,
          Math.sin(angle) * 4.2,
        ),
      ];
      const curve = new THREE.QuadraticBezierCurve3(
        ...(points as [THREE.Vector3, THREE.Vector3, THREE.Vector3]),
      );
      const vertices: number[] = [],
        indices: number[] = [];
      for (let j = 0; j <= 8; j++) {
        const t = j / 8,
          p = curve.getPoint(t),
          width = Math.sin(t * Math.PI) * 0.55;
        vertices.push(
          p.x - Math.sin(angle) * width,
          p.y,
          p.z + Math.cos(angle) * width,
          p.x + Math.sin(angle) * width,
          p.y,
          p.z - Math.cos(angle) * width,
        );
        if (j < 8) {
          const k = j * 2;
          indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
        }
      }
      const geom = new THREE.BufferGeometry();
      geom.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3),
      );
      geom.setIndex(indices);
      geom.computeVertexNormals();
      const leafMat = material(i % 2 ? "#527b52" : "#78965d");
      leafMat.side = THREE.DoubleSide;
      const leaf = new THREE.Mesh(geom, leafMat);
      leaf.castShadow = true;
      tree.add(leaf);
    }
    return tree;
  }
  function tree(x: number, z: number, scale = 1) {
    const group = new THREE.Group();
    group.position.set(x, 0.3, z);
    group.scale.setScalar(scale);
    scene.add(group);
    cylinder(group, 0, 2, 0, 0.23, 4, "#95815d");
    sphere(group, 0, 4.5, 0, 2.25, "#80956b");
    sphere(group, -1.1, 3.9, 0.6, 1.7, "#8ca371");
    sphere(group, 1, 4.8, -0.6, 1.8, "#728761");
    return group;
  }
  for (const [x, z, s] of [
    [-44, 3, 1],
    [-29, 3, 1.05],
    [-8, 4, 0.85],
    [24, 4, 0.95],
    [39, 3, 1.15],
    [-44, 20, 1.05],
    [-29, 20, 0.85],
    [-12, 20, 1.05],
    [23, 21, 1.1],
    [41, 20, 0.9],
    [44, -18, 1.1],
    [44, -36, 0.95],
    [-43, -39, 0.9],
    [20, -27, 0.9],
  ])
    palm(x!, z!, s!);
  for (const [x, z] of [
    [-45, -19],
    [-29, -20],
    [-8, -12],
    [-11, -22],
    [39, -23],
    [26, -43],
    [-46, 32],
    [3, 23],
    [7, 32],
    [25, 30],
  ])
    tree(x!, z!);
  // Planters, benches, cafe tables, lampposts, and street signs.
  function planter(x: number, z: number, w = 3) {
    box(scene, x, 0.55, z, w, 0.75, 1.5, "#d6c6aa");
    box(scene, x, 1, z, w - 0.2, 0.35, 1.3, "#7d9567");
    for (let i = 0; i < 3; i++)
      sphere(scene, x - w / 3 + (i * w) / 3, 1.4, z, 0.55, "#88a06b");
  }
  for (const [x, z] of [
    [-25, 1],
    [-10, 1],
    [-1, -19],
    [11, -19],
    [23, -1],
    [37, -1],
    [-31, 19],
    [28, 20],
    [38, 20],
  ])
    planter(x!, z!);
  function bench(x: number, z: number, rotation = 0) {
    const b = new THREE.Group();
    b.position.set(x, 0.3, z);
    b.rotation.y = rotation;
    scene.add(b);
    box(b, 0, 0.8, 0, 2.8, 0.15, 0.8, "#a68560");
    box(b, 0, 1.35, -0.4, 2.8, 0.65, 0.12, "#a68560");
    for (const xx of [-1, 1]) {
      box(b, xx, 0.4, 0, 0.16, 0.8, 0.6, "#526960");
      box(b, xx, 1, -0.4, 0.12, 1.2, 0.12, "#526960");
    }
  }
  for (const [x, z] of [
    [-6, -3],
    [-38, 4],
    [0, -18],
    [41, 8],
    [43, -7],
    [-21, 19],
  ])
    bench(x!, z!);
  const lamps: THREE.Mesh[] = [];
  for (const [x, z] of [
    [-38, 6],
    [-22, 6],
    [-5, 6],
    [25, 6],
    [40, 6],
    [-38, 18],
    [-18, 18],
    [4, 18],
    [28, 18],
    [42, 18],
    [20, -18],
    [9, -35],
  ]) {
    cylinder(scene, x!, 2.8, z!, 0.1, 5.2, "#526d66");
    box(scene, x! + 0.55, 5.4, z!, 1.3, 0.16, 0.22, "#526d66");
    lamps.push(box(scene, x! + 1, 5.2, z!, 0.55, 0.18, 0.45, "#e7d6a6", false));
  }
  for (const [x, z] of [
    [7, 5],
    [21, 19],
  ]) {
    cylinder(scene, x!, 2.8, z!, 0.11, 5, "#56655c");
    box(scene, x!, 5, z!, 0.7, 1.7, 0.55, "#40534c");
    for (let i = 0; i < 3; i++)
      sphere(
        scene,
        x!,
        5.5 - i * 0.5,
        z! + 0.3,
        0.16,
        ["#c86d53", "#d0b268", "#8fac70"][i]!,
      );
  }
  for (const x of [-39, -34]) {
    cylinder(scene, x, 1.1, 2.2, 0.85, 0.16, "#eee1c5");
    cylinder(scene, x, 0.6, 2.2, 0.08, 1.1, "#6a7462");
    const umbrella = new THREE.Mesh(
      new THREE.ConeGeometry(1.7, 0.7, 8),
      material("#dca277"),
    );
    umbrella.position.set(x, 3.2, 2.2);
    umbrella.castShadow = true;
    scene.add(umbrella);
    cylinder(scene, x, 1.8, 2.2, 0.045, 2.8, "#6a7462");
  }
  // A pocket park and a little fountain, nestled between the houses.
  box(scene, -4, 0.35, -7, 10, 0.1, 14, "#a8bc8a", false);
  cylinder(scene, -4, 0.7, -8, 2.8, 0.7, "#e0d4b7");
  cylinder(scene, -4, 1.05, -8, 2.45, 0.12, "#91bcba");
  cylinder(scene, -4, 1.7, -8, 0.35, 1.2, "#e3d8bc");
  cylinder(scene, -4, 2.3, -8, 1.1, 0.22, "#e3d8bc");
  const fountainDrops: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++)
    fountainDrops.push(
      sphere(
        scene,
        -4 + Math.cos(i * 0.7) * 0.7,
        2.8,
        -8 + Math.sin(i * 0.7) * 0.7,
        0.09,
        "#b2d6d4",
      ),
    );
  bench(-6, -14);
  tree(-7, -1, 0.8);

  // A muted skyline extends the playable neighborhood into a larger city.
  const skyline = new THREE.Group();
  scene.add(skyline);
  for (let i = 0; i < 17; i++) {
    const h = 14 + ((i * 17) % 27);
    const x = -72 + i * 9;
    box(
      skyline,
      x,
      h / 2 - 2,
      -76 - (i % 3) * 8,
      6.5 + (i % 2) * 3,
      h,
      8,
      ["#c7cec2", "#c1ccbe", "#b6c7c0"][i % 3]!,
      false,
    );
    if (i % 3 === 0)
      box(skyline, x, h, -76 - (i % 3) * 8, 0.3, 6, 0.3, "#b4c1b2", false);
  }

  function car(color: string) {
    const group = new THREE.Group();
    box(group, 0, 0.8, 0, 2, 0.7, 4.2, color);
    box(group, 0, 1.4, -0.2, 1.8, 0.8, 2.3, color);
    box(group, 0, 1.42, 1, 1.65, 0.56, 0.035, "#5c787e", false);
    box(group, 0, 1.42, -1.38, 1.65, 0.56, 0.035, "#5c787e", false);
    for (const x of [-0.93, 0.93]) {
      box(group, x, 1.45, -0.2, 0.035, 0.55, 1.7, "#5c787e", false);
      for (const z of [-1.3, 1.3]) {
        const wheel = cylinder(group, x * 1.1, 0.55, z, 0.4, 0.24, "#3f4b47");
        wheel.rotation.z = Math.PI / 2;
      }
      box(group, x * 0.7, 0.86, 2.14, 0.45, 0.23, 0.05, "#f3e8bd", false);
      box(group, x * 0.7, 0.86, -2.14, 0.45, 0.2, 0.05, "#b9715c", false);
    }
    scene.add(group);
    return group;
  }
  const traffic = [
    { model: car("#d78262"), lane: "x", offset: -36, speed: 4.4, direction: 1 },
    { model: car("#e0cea0"), lane: "x", offset: 18, speed: 3.8, direction: -1 },
    { model: car("#6d928c"), lane: "x", offset: 42, speed: 4.2, direction: 1 },
    { model: car("#b4b9ac"), lane: "z", offset: -32, speed: 3.6, direction: 1 },
    { model: car("#cf9c71"), lane: "z", offset: 8, speed: 4, direction: -1 },
  ];
  const parked = car("#e7c56e");
  parked.position.set(-28, 0.33, 5);
  parked.rotation.y = Math.PI / 2;
  const bike = new THREE.Group();
  bike.position.set(40, 0.4, -5);
  scene.add(bike);
  for (const z of [-0.8, 0.8]) {
    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.65, 0.07, 6, 16),
      material("#536660"),
    );
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(0, 0.7, z);
    bike.add(wheel);
  }
  box(bike, 0, 1.1, 0, 0.12, 0.1, 1.4, "#db8966");

  const capsuleGeometries = new Map<string, THREE.CapsuleGeometry>();
  const headGeometry = new THREE.SphereGeometry(0.33, 16, 12);
  const hairGeometry = new THREE.SphereGeometry(
    0.345,
    16,
    10,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.52,
  );
  function capsule(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    radius: number,
    length: number,
    color: string,
  ) {
    const key = `${radius}:${length}`;
    if (!capsuleGeometries.has(key))
      capsuleGeometries.set(
        key,
        new THREE.CapsuleGeometry(radius, length, 5, 10),
      );
    const mesh = new THREE.Mesh(capsuleGeometries.get(key)!, material(color));
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function joint(parent: THREE.Object3D, x: number, y: number, z = 0) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    parent.add(pivot);
    return pivot;
  }
  function person(color: string) {
    const group = new THREE.Group();
    const torso = joint(group, 0, 1.56);
    const hoodie = capsule(torso, 0, 0, 0, 0.33, 0.44, color);
    hoodie.scale.z = 0.7;
    cylinder(torso, 0, 0.51, 0, 0.1, 0.18, "#e6b48e");
    const head = new THREE.Mesh(headGeometry, material("#e6b48e"));
    head.position.set(0, 0.85, 0);
    head.castShadow = true;
    torso.add(head);
    const hair = new THREE.Mesh(hairGeometry, material("#403c37"));
    hair.position.copy(head.position);
    hair.rotation.z = -0.08;
    hair.castShadow = true;
    torso.add(hair);
    for (const side of [-1, 1]) {
      sphere(torso, side * 0.32, 0.83, 0, 0.065, "#e6b48e");
      sphere(torso, side * 0.105, 0.84, 0.303, 0.023, "#403c37");
    }
    sphere(torso, 0, 0.77, 0.329, 0.043, "#dca581");
    const leftLeg = joint(group, -0.19, 1.12);
    const rightLeg = joint(group, 0.19, 1.12);
    const knees = [leftLeg, rightLeg].map((leg) => {
      capsule(leg, 0, -0.26, 0, 0.125, 0.32, "#344e4c");
      const knee = joint(leg, 0, -0.54);
      capsule(knee, 0, -0.23, 0, 0.11, 0.3, "#344e4c");
      const shoe = capsule(knee, 0, -0.46, 0.085, 0.12, 0.21, "#faf2e1");
      shoe.rotation.x = Math.PI / 2;
      shoe.scale.z = 0.75;
      return knee;
    });
    const leftArm = joint(torso, -0.43, 0.33);
    const rightArm = joint(torso, 0.43, 0.33);
    const elbows = [leftArm, rightArm].map((arm) => {
      capsule(arm, 0, -0.22, 0, 0.11, 0.28, color);
      const elbow = joint(arm, 0, -0.45);
      capsule(elbow, 0, -0.2, 0, 0.09, 0.25, color);
      sphere(elbow, 0, -0.44, 0, 0.095, "#e6b48e");
      return elbow;
    });
    scene.add(group);
    return {
      group,
      torso,
      leftLeg,
      rightLeg,
      leftArm,
      rightArm,
      leftKnee: knees[0]!,
      rightKnee: knees[1]!,
      leftElbow: elbows[0]!,
      rightElbow: elbows[1]!,
    };
  }
  const player = person("#ee7047");
  player.group.position.set(8, 0.3, 20.5);
  player.group.scale.setScalar(2.35);
  const backpack = capsule(player.torso, 0, 0.03, -0.28, 0.24, 0.23, "#3d625d");
  backpack.scale.z = 0.6;
  player.group.rotation.y = -0.3;
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: "#e88256",
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const playerRing = new THREE.Mesh(
    new THREE.RingGeometry(1.4, 1.9, 40),
    ringMaterial,
  );
  playerRing.rotation.x = -Math.PI / 2;
  playerRing.position.set(8, 0.45, 20.5);
  scene.add(playerRing);
  const playerPointer = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 0.9, 4),
    new THREE.MeshBasicMaterial({ color: "#e7784c", depthTest: false }),
  );
  playerPointer.rotation.z = Math.PI;
  playerPointer.renderOrder = 10;
  scene.add(playerPointer);
  const npcs = [
    person("#739286"),
    person("#a883a3"),
    person("#d1ad6a"),
    person("#91a0b4"),
  ];
  const portalRings: THREE.Mesh[] = [];
  for (const place of Object.values(places)) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 1.85, 48),
      new THREE.MeshBasicMaterial({
        color: place.color,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(place.entrance.x, 0.43, place.entrance.z);
    scene.add(ring);
    portalRings.push(ring);
  }

  const keys = new Set<string>();
  let route: Point[] = [],
    routeDestination: Destination | null = null,
    paused = false,
    suppressed: Destination | null = null,
    night = false,
    disposed = false;
  let nearest: Destination | null = null,
    previousNear: Destination | null = null;
  let animationId = 0,
    lastTime = 0,
    time = 0,
    gaitPhase = 0,
    lastNotification = 0;
  const projected = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  let pointerStart = { x: 0, y: 0 };
  const pointerDown = (event: PointerEvent) => {
    pointerStart = { x: event.clientX, y: event.clientY };
  };
  const pointerUp = (event: PointerEvent) => {
    if (
      Math.hypot(
        event.clientX - pointerStart.x,
        event.clientY - pointerStart.y,
      ) > 7 ||
      paused
    )
      return;
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const hits = raycaster.intersectObjects([blog, gallery, news], true);
    if (!hits.length) return;
    let object: THREE.Object3D | null = hits[0]!.object;
    while (object && !object.userData.destination) object = object.parent;
    if (object?.userData.destination)
      visit(object.userData.destination as Destination);
  };
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointerup", pointerUp);
  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    skyline.visible = width >= 650;
    billboard.visible = width >= 650;
    renderer.setSize(width, height, false);
    const aspect = width / height;
    const viewHeight = aspect < 0.8 ? 140 : aspect < 1.2 ? 92 : 72;
    const offset = camera.position.clone().sub(controls.target);
    viewTarget.copy(width < 650 ? new THREE.Vector3(6, 0, -10) : initialTarget);
    controls.target.copy(viewTarget);
    camera.position.copy(viewTarget).add(offset);
    camera.left = (-viewHeight * aspect) / 2;
    camera.right = (viewHeight * aspect) / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  function visit(id: Destination) {
    if (paused) return false;
    if (
      Math.hypot(
        player.group.position.x - places[id].entrance.x,
        player.group.position.z - places[id].entrance.z,
      ) < 3.6
    ) {
      suppressed = id;
      handlers.enter(id);
      return true;
    }
    route = findPath(player.group.position, places[id].entrance, obstacles);
    routeDestination = route.length ? id : null;
    if (route.length) handlers.travelling(id);
    return route.length > 0;
  }
  function animate(timestamp: number) {
    if (disposed) return;
    animationId = requestAnimationFrame(animate);
    const delta = Math.min((timestamp - (lastTime || timestamp)) / 1000, 0.12);
    lastTime = timestamp;
    time += delta;
    const position = player.group.position;
    let dx = 0,
      dz = 0;
    let waypointDistance = Infinity;
    if (!paused) {
      const right =
        Number(keys.has("ArrowRight") || keys.has("d")) -
        Number(keys.has("ArrowLeft") || keys.has("a"));
      const forward =
        Number(keys.has("ArrowUp") || keys.has("w")) -
        Number(keys.has("ArrowDown") || keys.has("s"));
      if (right || forward) {
        route = [];
        routeDestination = null;
        const angle = controls.getAzimuthalAngle();
        dx = right * Math.cos(angle) - forward * Math.sin(angle);
        dz = -right * Math.sin(angle) - forward * Math.cos(angle);
        const length = Math.hypot(dx, dz);
        dx /= length;
        dz /= length;
      } else if (route.length) {
        const next = route[0]!;
        const distance = Math.hypot(next.x - position.x, next.z - position.z);
        if (distance < 0.08) route.shift();
        else {
          dx = (next.x - position.x) / distance;
          dz = (next.z - position.z) / distance;
          waypointDistance = distance;
        }
      }
      const running = keys.has("Shift") || route.length > 0;
      const speed = running ? 21 : 11;
      if (dx || dz) {
        const travel = Math.min(speed * delta, waypointDistance);
        const steps = Math.max(1, Math.ceil(travel / 0.2));
        const stepX = (dx * travel) / steps,
          stepZ = (dz * travel) / steps;
        // Short collision steps keep running safe at lower frame rates.
        for (let step = 0; step < steps; step++) {
          if (canWalk({ x: position.x + stepX, z: position.z }, obstacles))
            position.x += stepX;
          if (canWalk({ x: position.x, z: position.z + stepZ }, obstacles))
            position.z += stepZ;
        }
        const targetAngle = Math.atan2(dx, dz);
        const angleDelta = Math.atan2(
          Math.sin(targetAngle - player.group.rotation.y),
          Math.cos(targetAngle - player.group.rotation.y),
        );
        player.group.rotation.y += angleDelta * Math.min(delta * 12, 1);
        gaitPhase += delta * (running ? 17 : 10);
        const stride = Math.sin(gaitPhase);
        player.leftLeg.rotation.x = stride * (running ? 0.95 : 0.45);
        player.rightLeg.rotation.x = -player.leftLeg.rotation.x;
        player.leftKnee.rotation.x =
          (running ? 0.45 : 0.05) +
          Math.max(0, -stride) * (running ? 0.85 : 0.45);
        player.rightKnee.rotation.x =
          (running ? 0.45 : 0.05) +
          Math.max(0, stride) * (running ? 0.85 : 0.45);
        player.leftArm.rotation.x = -stride * (running ? 0.8 : 0.3);
        player.rightArm.rotation.x = -player.leftArm.rotation.x;
        player.leftElbow.rotation.x = running ? -1.1 : -0.15;
        player.rightElbow.rotation.x = running ? -1.1 : -0.15;
        player.torso.rotation.x = running ? 0.16 : 0;
        position.y =
          0.3 + Math.abs(Math.sin(gaitPhase * 2)) * (running ? 0.13 : 0.035);
      } else {
        const settle = Math.exp(-delta * 14);
        for (const joint of [
          player.leftLeg,
          player.rightLeg,
          player.leftArm,
          player.rightArm,
          player.leftKnee,
          player.rightKnee,
          player.leftElbow,
          player.rightElbow,
          player.torso,
        ])
          joint.rotation.x *= settle;
        position.y = 0.3 + (position.y - 0.3) * settle;
      }
      nearest = null;
      for (const id of Object.keys(places) as Destination[]) {
        const p = places[id].entrance,
          distance = Math.hypot(position.x - p.x, position.z - p.z);
        if (id === suppressed && distance > 7) suppressed = null;
        if (distance < 6) nearest = id;
        if (
          distance < 2.8 &&
          suppressed !== id &&
          (!routeDestination || routeDestination === id)
        ) {
          route = [];
          routeDestination = null;
          suppressed = id;
          handlers.enter(id);
          break;
        }
      }
      if (nearest !== previousNear) {
        previousNear = nearest;
        handlers.near(nearest);
      }
    }
    playerRing.position.set(position.x, 0.45, position.z);
    playerPointer.position.set(
      position.x,
      7.5 + Math.sin(time * 3) * 0.17,
      position.z,
    );
    playerRing.scale.setScalar(1 + Math.sin(time * 2.5) * 0.07);
    for (const ring of portalRings)
      (ring.material as THREE.MeshBasicMaterial).opacity =
        0.45 + Math.sin(time * 2) * 0.16;
    for (const vehicle of traffic) {
      const coordinate =
        (((time * vehicle.speed + vehicle.offset + 120) % 100) - 50) *
        vehicle.direction;
      if (vehicle.lane === "x") {
        vehicle.model.position.set(
          coordinate,
          0.35,
          12 + vehicle.direction * 2.1,
        );
        vehicle.model.rotation.y = (vehicle.direction * Math.PI) / 2;
      } else {
        vehicle.model.position.set(
          14 - vehicle.direction * 2.1,
          0.35,
          coordinate * 0.82,
        );
        vehicle.model.rotation.y = vehicle.direction === 1 ? 0 : Math.PI;
      }
    }
    npcs.forEach((npc, i) => {
      const p = ((time * 1.05 + i * 19) % 70) - 40;
      npc.group.position.set(p, 0.35, i % 2 ? 18 : 6);
      npc.group.rotation.y = Math.PI / 2;
      npc.leftLeg.rotation.x = Math.sin(time * 6 + i) * 0.35;
      npc.rightLeg.rotation.x = -Math.sin(time * 6 + i) * 0.35;
    });
    fountainDrops.forEach((drop, i) => {
      drop.position.y = 2.55 + Math.sin(time * 4 + i * 0.7) * 0.35;
    });
    waterMat.color.set(night ? "#365f70" : "#7cb9ba");
    controls.update();
    if (timestamp - lastNotification > 50) {
      const rect = canvas.getBoundingClientRect();
      handlers.labels(
        (Object.keys(places) as Destination[]).map((id) => {
          const p = places[id];
          projected.set(p.x, p.height + 1.2, p.z).project(camera);
          return {
            id,
            x: ((projected.x + 1) * rect.width) / 2,
            y: ((-projected.y + 1) * rect.height) / 2,
            visible:
              projected.z < 1 &&
              Math.abs(projected.x) < 1.1 &&
              Math.abs(projected.y) < 1.1,
          };
        }),
      );
      handlers.position({ x: position.x, z: position.z });
      lastNotification = timestamp;
    }
    renderer.render(scene, camera);
  }
  animationId = requestAnimationFrame(animate);
  handlers.ready();

  return {
    visit,
    setNight(value) {
      night = value;
      hemi.intensity = value ? 1.3 : 2.5;
      hemi.color.set(value ? "#7494c4" : "#f9f1df");
      sun.intensity = value ? 0.55 : 3.4;
      sun.color.set(value ? "#9cb3da" : "#fff0d6");
      renderer.toneMappingExposure = value ? 0.9 : 1.18;
      scene.fog = new THREE.Fog(value ? "#25374b" : "#e8e4d9", 170, 290);
      const windowMaterial = material("#526e72");
      windowMaterial.emissive.set(value ? "#e7bd7f" : "#000000");
      windowMaterial.emissiveIntensity = value ? 0.65 : 0;
      for (const lamp of lamps) {
        const mat = lamp.material as THREE.MeshStandardMaterial;
        mat.emissive.set(value ? "#ffe5a0" : "#000000");
        mat.emissiveIntensity = value ? 2 : 0;
      }
    },
    resetCamera() {
      camera.position.copy(viewTarget).add(new THREE.Vector3(78, 88, 100));
      controls.target.copy(viewTarget);
      camera.zoom = controls.minZoom;
      camera.updateProjectionMatrix();
      controls.update();
    },
    setInput(key, pressed) {
      if (pressed) keys.add(key);
      else keys.delete(key);
    },
    setPaused(value) {
      paused = value;
      if (value) {
        keys.clear();
        route = [];
        routeDestination = null;
      }
    },
    interact() {
      if (nearest && !paused) {
        suppressed = nearest;
        route = [];
        routeDestination = null;
        handlers.enter(nearest);
      }
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(animationId);
      observer.disconnect();
      controls.dispose();
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointerup", pointerUp);
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>(),
        textures = new Set<THREE.Texture>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          geometries.add(object.geometry);
          for (const m of Array.isArray(object.material)
            ? object.material
            : [object.material]) {
            materials.add(m);
            if ("map" in m && m.map instanceof THREE.Texture)
              textures.add(m.map);
          }
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
    },
  };
}
