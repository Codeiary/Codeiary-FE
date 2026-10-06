import type { Point, Obstacle } from "./navigation";

interface Area extends Point {
  width: number;
  depth: number;
}

export interface Park extends Area {
  feature?: "fountain" | "sculpture" | "flowers";
  kind: "garden" | "square" | "grove";
}

interface NeighborhoodLayout {
  theme: "new-york" | "seoul" | "tokyo";
  facades: readonly string[];
  plots: readonly Point[];
  streets: readonly Area[];
  parks: readonly Park[];
  busStop: Area;
  landmarks: readonly Landmark[];
}

export interface Landmark extends Area {
  kind: "liberty" | "tower" | "seoul-tower" | "tokyo-tower" | "torii";
}

export const NEIGHBORHOOD_DEPTH = { minZ: -59, maxZ: 67 };

// Local coordinates keep the same three plans repeatable across streamed blocks.
// Each plan reserves ten homes, with separate non-interactive landmark sites.
const layouts: readonly NeighborhoodLayout[] = [
  {
    theme: "new-york",
    facades: ["#b48770", "#c59c83", "#ae806d", "#be9e80", "#a98973"],
    // Staggered houses with garden walks between the front and rear plots.
    busStop: { x: 41, z: 3, width: 8, depth: 3 },
    landmarks: [
      { kind: "liberty", x: 30, z: -5, width: 8, depth: 8 },
      { kind: "tower", x: 85, z: -48, width: 11, depth: 11 },
    ],
    plots: [
      { x: 12, z: -13 },
      { x: 32, z: -29 },
      { x: 53, z: -8 },
      { x: 73, z: -26 },
      { x: 89, z: -5 },
      { x: 12, z: 31 },
      { x: 31, z: 51 },
      { x: 50, z: 29 },
      { x: 69, z: 50 },
      { x: 89, z: 30 },
    ],
    streets: [],
    parks: [
      { x: 50, z: -51, width: 86, depth: 17, kind: "garden" },
      {
        x: 30,
        z: -5,
        width: 14,
        depth: 13,
        kind: "garden",
      },
      {
        x: 68,
        z: -5,
        width: 11,
        depth: 12,
        kind: "garden",
        feature: "flowers",
      },
    ],
  },
  {
    theme: "seoul",
    facades: ["#d0c9b5", "#b8c6c0", "#bac2b9", "#cbbba5", "#aabebd"],
    // Homes frame the rear fountain square and an open foreground.
    busStop: { x: 70, z: 3, width: 8, depth: 3 },
    landmarks: [{ kind: "seoul-tower", x: 82, z: -50, width: 14, depth: 14 }],
    plots: [
      { x: 12, z: -8 },
      { x: 13, z: -33 },
      { x: 34, z: -35 },
      { x: 68, z: -35 },
      { x: 88, z: -12 },
      { x: 12, z: 28 },
      { x: 32, z: 49 },
      { x: 52, z: 51 },
      { x: 74, z: 48 },
      { x: 88, z: 28 },
    ],
    streets: [],
    parks: [
      {
        x: 50,
        z: -12,
        width: 28,
        depth: 29,
        kind: "square",
        feature: "fountain",
      },
      { x: 50, z: -56, width: 88, depth: 14, kind: "grove" },
    ],
  },
  {
    theme: "tokyo",
    facades: ["#d2c7b6", "#c4bcaa", "#b4bfbb", "#d3c9b8", "#c1b0a0"],
    // Offset side streets divide this block into small clusters and corner gardens.
    busStop: { x: 48, z: 3, width: 8, depth: 3 },
    landmarks: [
      { kind: "torii", x: 71, z: -40, width: 8, depth: 6 },
      { kind: "tokyo-tower", x: 86, z: -9, width: 11, depth: 11 },
    ],
    plots: [
      { x: 10, z: -34 },
      { x: 10, z: -7 },
      { x: 44, z: -23 },
      { x: 67, z: -8 },
      { x: 89, z: -33 },
      { x: 12, z: 29 },
      { x: 35, z: 49 },
      { x: 55, z: 28 },
      { x: 91, z: 29 },
      { x: 92, z: 53 },
    ],
    streets: [
      { x: 27, z: -18, width: 6, depth: 60 },
      { x: 75, z: 39, width: 6, depth: 54 },
    ],
    parks: [
      {
        x: 69,
        z: -37,
        width: 17,
        depth: 17,
        kind: "garden",
      },
      { x: 50, z: -58, width: 85, depth: 14, kind: "grove" },
    ],
  },
];

export function neighborhoodLayout(page: number): NeighborhoodLayout {
  return layouts[((page % layouts.length) + layouts.length) % layouts.length]!;
}

// Rendering and movement share the footprint of each solid centerpiece.
export function parkFeatureObstacle(park: Park): Obstacle | undefined {
  if (!park.feature) return undefined;
  const size =
    park.feature === "fountain" ? Math.min(park.width, park.depth) * 0.38 : 5;
  return {
    x: park.x,
    z: park.z,
    width: size,
    depth: size,
  };
}
