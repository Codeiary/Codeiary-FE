export type HouseLevel = 0 | 1 | 2 | 3 | 4 | 5;

export function normalizeHouseLevel(
  value: number | null | undefined,
): HouseLevel {
  return Number.isFinite(value)
    ? (Math.max(0, Math.min(5, Math.floor(value!))) as HouseLevel)
    : 0;
}

export function houseLevelForPostCount(postCount: number): HouseLevel {
  return normalizeHouseLevel(Math.floor(Math.max(0, postCount) / 10));
}

const tiers = [
  { name: "일반 건물", floors: 3, width: 12, roofHeight: 1.4 },
  { name: "모던 하우스", floors: 3, width: 12, roofHeight: 2.8 },
  { name: "타워 하우스", floors: 5, width: 14, roofHeight: 3.5 },
  { name: "럭셔리 레지던스", floors: 5, width: 14, roofHeight: 3.8 },
  { name: "프리미엄 빌라", floors: 5, width: 14, roofHeight: 5.2 },
  { name: "VIP 타워", floors: 5, width: 14, roofHeight: 6.2 },
] as const;

export function residenceTier(value: number) {
  const level = normalizeHouseLevel(value);
  const tier = tiers[level];
  return { ...tier, level, depth: 11, height: tier.floors * 3.2 + 1.1 };
}
