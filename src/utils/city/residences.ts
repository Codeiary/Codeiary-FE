import type { BlogAuthor } from "@/utils/blog/posts";
import { neighborhoodLayout } from "./neighborhood-layouts";
import type { HouseLevel } from "./residence-tiers";

export interface Residence extends BlogAuthor {
  role: "ADMIN" | "USER";
  postCount: number;
  level: HouseLevel;
  activityPoints: number | null;
  activity: number;
  email?: string;
  github?: string;
}

export const HOMES_PER_BLOCK = 10;
export const BLOCK_WIDTH = 100;
export const RESIDENTIAL_START = 84;

export function orderedResidences(residents: readonly Residence[]) {
  return [...residents].sort(
    (a, b) =>
      (b.activityPoints ?? b.activity) - (a.activityPoints ?? a.activity) ||
      String(a.id).localeCompare(String(b.id)),
  );
}

export function residencePosition(index: number) {
  const block = Math.floor(index / HOMES_PER_BLOCK);
  const slot = index % HOMES_PER_BLOCK;
  const plot = neighborhoodLayout(block).plots[slot]!;
  return {
    x: RESIDENTIAL_START + block * BLOCK_WIDTH + plot.x,
    z: plot.z,
    entranceZ: plot.z + 8,
    rotation: 0,
  };
}
