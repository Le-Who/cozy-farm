import type { FarmState } from './farm.ts'
import { isHenGround, projectHenToGround, type HenBuildingLevels, type HenNativePoint } from './hen-roaming.ts'

export type HenCompanionStatus = { id: number; returning: boolean }
export type HenCompanion = HenCompanionStatus & { point: HenNativePoint; path: HenNativePoint[]; target?: HenNativePoint; planAfter: number }
const distance = (a: HenNativePoint, b: HenNativePoint) => Math.hypot(a.x - b.x, a.y - b.y)
const stepSize = 16, columns = 101, rows = 63
const grids = new Map<string, Map<number, HenNativePoint>>()

export function canWalkWithHen(farm: FarmState, id: unknown): id is number {
  return farm.island === 'home' && typeof id === 'number' && Number.isInteger(id) && id >= 0 && id < farm.flockSize
    && farm.henFriendship.hens[id].points >= 3
}

/** Sample at less than the thinnest authored obstacle; endpoints must also be safe. */
export function isHenWalkSegment(from: HenNativePoint, to: HenNativePoint, levels: HenBuildingLevels) {
  const length = distance(from, to)
  if (!Number.isFinite(length)) return false
  const samples = Math.max(1, Math.ceil(length / 4))
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    if (!isHenGround({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }, levels)) return false
  }
  return true
}

function grid(levels: HenBuildingLevels) {
  const key = [levels.farmhouse, levels.coop, levels.well].map(level => Number(level >= 2)).join('')
  let points = grids.get(key)
  if (points) return points
  points = new Map()
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const point = { x: x * stepSize, y: y * stepSize }
    if (isHenGround(point, levels)) points.set(y * columns + x, point)
  }
  grids.set(key, points)
  return points
}

/** Bounded A* on the same shore/building/fence mask as dragging. No route means wait, never cross an obstacle. */
export function henWalkPath(start: HenNativePoint, finish: HenNativePoint, levels: HenBuildingLevels): HenNativePoint[] {
  const from = projectHenToGround(start, levels), to = projectHenToGround(finish, levels)
  if (isHenWalkSegment(from, to, levels)) return [to]
  const points = grid(levels)
  const neighbours = (point: HenNativePoint) => [...points.entries()].filter(([, next]) => distance(point, next) <= 64 && isHenWalkSegment(point, next, levels))
  const endings = new Map(neighbours(to).map(([id, point]) => [id, distance(point, to)]))
  const costs = new Map<number, number>(), previous = new Map<number, number>(), open = new Set<number>()
  for (const [id, point] of neighbours(from)) { costs.set(id, distance(from, point)); open.add(id) }
  let reached: number | undefined
  while (open.size) {
    let current = -1, best = Infinity
    for (const id of open) {
      const score = costs.get(id)! + distance(points.get(id)!, to)
      if (score < best) { best = score; current = id }
    }
    open.delete(current)
    if (endings.has(current)) { reached = current; break }
    const point = points.get(current)!, x = current % columns, y = Math.floor(current / columns)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((!dx && !dy) || x + dx < 0 || x + dx >= columns || y + dy < 0 || y + dy >= rows) continue
      const id = current + dy * columns + dx, next = points.get(id)
      if (!next || !isHenWalkSegment(point, next, levels)) continue
      const cost = costs.get(current)! + distance(point, next)
      if (cost >= (costs.get(id) ?? Infinity)) continue
      costs.set(id, cost); previous.set(id, current); open.add(id)
    }
  }
  if (reached === undefined) return []
  const path = [to]
  for (let id: number | undefined = reached; id !== undefined; id = previous.get(id)) path.unshift(points.get(id)!)
  // Remove only visible intermediate points, leaving the gate and building turns intact.
  const smooth: HenNativePoint[] = []
  let anchor = from
  for (let i = 0; i < path.length;) {
    let next = i
    while (next + 1 < path.length && isHenWalkSegment(anchor, path[next + 1], levels)) next++
    anchor = path[next]; smooth.push({ ...anchor }); i = next + 1
  }
  return smooth
}

export function createHenCompanion(id: number, point: HenNativePoint): HenCompanion {
  return { id, point: { ...point }, returning: false, path: [], planAfter: 0 }
}

export function returnHenCompanion(walk: HenCompanion) {
  walk.returning = true; walk.path = []; walk.target = undefined; walk.planAfter = 0
}

/** Runtime-only companionship never changes feed, friendship, saved positions, days or orders. */
export function stepHenCompanion(walk: HenCompanion, farmer: HenNativePoint, home: HenNativePoint, levels: HenBuildingLevels, dt: number, now: number, reducedMotion = false): boolean {
  walk.point = projectHenToGround(walk.point, levels)
  const away = distance(walk.point, farmer)
  if (walk.returning && distance(walk.point, home) < 2) { walk.point = { ...home }; return true }
  if (!walk.returning && away <= 72) { walk.path = []; return false }
  const target = walk.returning ? home : projectHenToGround({
    x: farmer.x + (walk.point.x - farmer.x) / Math.max(1, away) * 52,
    y: farmer.y + (walk.point.y - farmer.y) / Math.max(1, away) * 52,
  }, levels)
  if (now >= walk.planAfter && (!walk.path.length || !walk.target || distance(target, walk.target) > 48)) {
    walk.path = henWalkPath(walk.point, target, levels); walk.target = { ...target }; walk.planAfter = now + .6
  }
  if (reducedMotion) {
    if (walk.path.length) walk.point = { ...walk.path[walk.path.length - 1] }
    walk.path = []
    return walk.returning && distance(walk.point, home) < 2
  }
  let remaining = Math.max(0, Math.min(.06, Number.isFinite(dt) ? dt : 0)) * 155
  while (remaining > 0 && walk.path.length) {
    const next = walk.path[0], length = distance(walk.point, next)
    const ratio = Math.min(1, remaining / Math.max(.00001, length))
    const step = { x: walk.point.x + (next.x - walk.point.x) * ratio, y: walk.point.y + (next.y - walk.point.y) * ratio }
    if (!isHenWalkSegment(walk.point, step, levels)) { walk.path = []; walk.target = undefined; break }
    walk.point = step; remaining -= length
    if (ratio === 1) walk.path.shift()
  }
  return walk.returning && distance(walk.point, home) < 2
}
