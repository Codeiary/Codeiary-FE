export type Point = { x: number; z: number };
export type Obstacle = { x: number; z: number; width: number; depth: number };

export const WORLD_BOUNDS = { minX: -47, maxX: 43, minZ: -43, maxZ: 43 };
export const PLAYER_RADIUS = 1.1;
export type WorldBounds = typeof WORLD_BOUNDS;

export function canWalk(
  point: Point,
  obstacles: Obstacle[],
  bounds: WorldBounds = WORLD_BOUNDS,
) {
  const b = bounds;
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
  bounds: WorldBounds = WORLD_BOUNDS,
): Point[] {
  const step = 1.5;
  const grid = (p: Point) => ({
    x: Math.round(p.x / step),
    z: Math.round(p.z / step),
  });
  const key = (p: Point) => `${p.x},${p.z}`;
  const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
  const physical = (p: Point) => ({ x: p.x * step, z: p.z * step });
  function clearSegment(a: Point, b: Point) {
    const samples = Math.max(1, Math.ceil(distance(a, b) / 0.25));
    for (let i = 0; i <= samples; i++) {
      const fraction = i / samples;
      if (
        !canWalk(
          { x: a.x + (b.x - a.x) * fraction, z: a.z + (b.z - a.z) * fraction },
          obstacles,
          bounds,
        )
      )
        return false;
    }
    return true;
  }
  // A rounded grid cell can be inside a building even when the player is outside.
  // Connect the actual position to a nearby reachable cell before searching.
  function connectedCell(point: Point) {
    const center = grid(point),
      candidates: Point[] = [];
    for (let x = -2; x <= 2; x++)
      for (let z = -2; z <= 2; z++)
        candidates.push({ x: center.x + x, z: center.z + z });
    candidates.sort(
      (a, b) => distance(physical(a), point) - distance(physical(b), point),
    );
    return candidates.find((cell) => clearSegment(point, physical(cell)));
  }
  const from = connectedCell(start),
    to = connectedCell(end);
  if (!from || !to) return [];
  if (clearSegment(start, end)) return [end];
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
    if (key(current) === key(to)) {
      const path: Point[] = [end];
      let cursor: Point | undefined = current;
      while (cursor) {
        path.push(physical(cursor));
        if (key(cursor) === key(from)) break;
        cursor = previous.get(key(cursor));
      }
      path.reverse();
      const smooth: Point[] = [];
      let anchor = start,
        index = 0;
      while (index < path.length) {
        let next = path.length - 1;
        while (next > index && !clearSegment(anchor, path[next]!)) next--;
        anchor = path[next]!;
        smooth.push(anchor);
        index = next + 1;
      }
      return smooth;
    }
    closed.add(key(current));
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue;
        const next = { x: current.x + dx, z: current.z + dz };
        const nextKey = key(next);
        if (closed.has(nextKey)) continue;
        const physical = { x: next.x * step, z: next.z * step };
        if (!canWalk(physical, obstacles, bounds)) continue;
        if (
          dx &&
          dz &&
          (!canWalk(
            { x: current.x * step, z: physical.z },
            obstacles,
            bounds,
          ) ||
            !canWalk({ x: physical.x, z: current.z * step }, obstacles, bounds))
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
