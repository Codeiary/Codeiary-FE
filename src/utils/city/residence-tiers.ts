export type HouseLevel = 0 | 1 | 2 | 3 | 4 | 5;

export function normalizeHouseLevel(
  value: number | null | undefined,
): HouseLevel {
  return Number.isFinite(value)
    ? (Math.max(0, Math.min(5, Math.floor(value!))) as HouseLevel)
    : 0;
}

const tiers = [
  { name: "일반 건물", floors: 3, width: 12, roofHeight: 1.4 },
  { name: "모던 건물", floors: 3, width: 12, roofHeight: 2.2 },
  { name: "5층 건물", floors: 5, width: 14, roofHeight: 1.4 },
  { name: "럭셔리 건물", floors: 5, width: 14, roofHeight: 2.3 },
  { name: "프리미엄 건물", floors: 5, width: 14, roofHeight: 2.3 },
  { name: "VIP 레지던스", floors: 5, width: 14, roofHeight: 4 },
] as const;

export function residenceTier(value: number) {
  const level = normalizeHouseLevel(value);
  const tier = tiers[level];
  return { ...tier, level, depth: 11, height: tier.floors * 3.2 + 1.1 };
}
