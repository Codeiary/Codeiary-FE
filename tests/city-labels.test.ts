import { describe, expect, it } from "vitest";
import { layoutLabels } from "@/utils/city/label-layout";

describe("도시 건물 이름표", () => {
  it("가까운 건물 이름표가 서로 겹치지 않게 배치할 수 있다.", () => {
    const anchors = ["blog", "portfolio", "news", "home"].map((id, index) => ({
      id,
      x: 250 + index * 25,
      y: 180,
      visible: true,
    }));
    const size = { width: 150, height: 54 };
    const labels = layoutLabels(
      anchors,
      new Map(anchors.map((anchor) => [anchor.id, size])),
      800,
      600,
    );
    for (let i = 0; i < labels.length; i++)
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i]!,
          b = labels[j]!;
        expect(
          Math.abs(a.x - b.x) >= size.width + 8 ||
            Math.abs(a.y - b.y) >= size.height + 8,
        ).toBe(true);
      }
  });
  it("긴 사용자 이름의 이름표를 화면 안에서 표시할 수 있다.", () => {
    const [label] = layoutLabels(
      [{ id: "home", x: 380, y: 60, visible: true }],
      new Map([["home", { width: 210, height: 54 }]]),
      390,
      700,
    );
    expect(label!.x + 105).toBeLessThanOrEqual(390 - 8);
    expect(label!.y - 54).toBeGreaterThanOrEqual(8);
  });
});
