export interface LabelAnchor {
  id: string;
  x: number;
  y: number;
  visible: boolean;
}
export interface LabelSize {
  width: number;
  height: number;
}

// Keep landmark labels readable when buildings project close together.
export function layoutLabels<T extends LabelAnchor>(
  anchors: T[],
  sizes: Map<string, LabelSize>,
  width: number,
  height: number,
) {
  const gap = 8;
  const occupied: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  }[] = [];
  return anchors.map((anchor) => {
    const size = sizes.get(anchor.id) ?? { width: 150, height: 54 };
    const boundX = (x: number) =>
      Math.max(gap, Math.min(x, width - size.width - gap));
    const boundY = (y: number) =>
      Math.max(gap, Math.min(y, height - size.height - 24));
    const left = boundX(anchor.x - size.width / 2),
      top = boundY(anchor.y - size.height);
    const xs = [
      left,
      ...occupied.flatMap((rect) => [
        rect.left - size.width - gap,
        rect.right + gap,
      ]),
    ].map(boundX);
    const ys = [
      top,
      ...occupied.flatMap((rect) => [
        rect.top - size.height - gap,
        rect.bottom + gap,
      ]),
    ].map(boundY);
    const candidates = xs.flatMap((x) =>
      ys.map((y) => ({
        left: x,
        top: y,
        right: x + size.width,
        bottom: y + size.height,
      })),
    );
    candidates.sort(
      (a, b) =>
        Math.hypot(a.left - left, a.top - top) -
        Math.hypot(b.left - left, b.top - top),
    );
    const rect =
      candidates.find((candidate) =>
        occupied.every(
          (other) =>
            candidate.right + gap <= other.left ||
            candidate.left >= other.right + gap ||
            candidate.bottom + gap <= other.top ||
            candidate.top >= other.bottom + gap,
        ),
      ) ?? candidates[0]!;
    if (anchor.visible) occupied.push(rect);
    return {
      ...anchor,
      x: rect.left + size.width / 2,
      y: rect.bottom,
      stemLeft: Math.max(12, Math.min(anchor.x - rect.left, size.width - 12)),
      stemHeight: Math.max(8, anchor.y + 18 - rect.bottom),
    };
  });
}
