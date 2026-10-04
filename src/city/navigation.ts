export type Point = { x: number; z: number };
export type Obstacle = { x: number; z: number; width: number; depth: number };

export const WORLD_BOUNDS = { minX: -47, maxX: 43, minZ: -43, maxZ: 36 };
export const PLAYER_RADIUS = 1.1;

export function canWalk(point: Point, obstacles: Obstacle[]) {
  const b = WORLD_BOUNDS;
  if (
    point.x < b.minX ||
    point.x > b.maxX ||
    point.z < b.minZ ||
    point.z > b.maxZ
  )
    return false;
  return !obstacles.some(
    (o) =>
      Math.abs(point.x - o.x) < o.width / 2 + PLAYER_RADIUS &&
      Math.abs(point.z - o.z) < o.depth / 2 + PLAYER_RADIUS,
  );
}

// An eight-direction grid lets click-to-visit share the same collision rules as walking.
export function findPath(
  start: Point,
  end: Point,
  obstacles: Obstacle[],
): Point[] {
  const step = 1.5;
  const grid = (p: Point) => ({
    x: Math.round(p.x / step),
    z: Math.round(p.z / step),
  });
  const from = grid(start),
    to = grid(end);
  const key = (p: Point) => `${p.x},${p.z}`;
  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
  const open = [from];
  const previous = new Map<string, Point>();
  const score = new Map<string, number>([[key(from), 0]]);
  const closed = new Set<string>();
  let iterations = 0;
  while (open.length && iterations++ < 5000) {
    open.sort(
      (a, b) =>
        score.get(key(a))! +
        distance(a, to) -
        (score.get(key(b))! + distance(b, to)),
    );
    const current = open.shift()!;
    if (distance(current, to) < 1.5) {
      const path: Point[] = [end];
      let cursor: Point | undefined = current;
      while (cursor && key(cursor) !== key(from)) {
        path.push({ x: cursor.x * step, z: cursor.z * step });
        cursor = previous.get(key(cursor));
      }
      return path.reverse();
    }
    closed.add(key(current));
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue;
        const next = { x: current.x + dx, z: current.z + dz };
        const nextKey = key(next);
        if (closed.has(nextKey)) continue;
        const physical = { x: next.x * step, z: next.z * step };
        if (!canWalk(physical, obstacles)) continue;
        if (
          dx &&
          dz &&
          (!canWalk({ x: current.x * step, z: physical.z }, obstacles) ||
            !canWalk({ x: physical.x, z: current.z * step }, obstacles))
        )
          continue;
        const cost = score.get(key(current))! + Math.hypot(dx, dz);
        if (cost >= (score.get(nextKey) ?? Infinity)) continue;
        score.set(nextKey, cost);
        previous.set(nextKey, current);
        if (!open.some((p) => key(p) === nextKey)) open.push(next);
      }
  }
  return [];
}
