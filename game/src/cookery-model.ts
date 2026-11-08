export type CookeryKind = 'preserves' | 'decorate'
export type CookeryPoint = { x: number; y: number }
export type CookeryStage = 'fruit' | 'stir' | 'fill' | 'sprinkle' | 'ready' | 'committing' | 'finished' | 'cancelled'
export type CookeryFruit = CookeryPoint & { id: number; angle: number }
export type CookeryModel = {
  kind: CookeryKind; stage: CookeryStage; fruit: CookeryFruit[]; fruitRequired: number;
  stirred: number; stirSectors: Set<number>; scoops: number; sprinkled: Set<number>;
  sprinkleTravel: number; last: CookeryPoint | null; particleSerial: number;
}
export const STIR_REQUIRED = Math.PI * 5
export const SCOOPS_REQUIRED = 3
export const SPRINKLE_TARGETS: readonly CookeryPoint[] = Array.from({ length: 25 }, (_, i) => {
  if (i === 0) return { x: 0, y: 0 }
  const ring = i <= 8 ? .38 : .73, count = i <= 8 ? 8 : 16, index = i <= 8 ? i - 1 : i - 9
  return { x: Math.cos(index / count * Math.PI * 2) * ring, y: Math.sin(index / count * Math.PI * 2) * ring }
})

export function createCookeryModel(kind: CookeryKind): CookeryModel {
  return { kind, stage: 'fruit', fruit: [], fruitRequired: kind === 'preserves' ? 5 : 3,
    stirred: 0, stirSectors: new Set(), scoops: 0, sprinkled: new Set(), sprinkleTravel: 0,
    last: null, particleSerial: 0 }
}
export const inCookerySurface = (point: CookeryPoint, radius = .91) => Number.isFinite(point.x) && Number.isFinite(point.y) && Math.hypot(point.x, point.y) <= radius

export function placeCookeryFruit(model: CookeryModel, id: number, point: CookeryPoint): boolean {
  const canArrange = model.kind === 'decorate' && ['fruit', 'sprinkle', 'ready'].includes(model.stage)
  if ((!canArrange && model.stage !== 'fruit') || !Number.isInteger(id) || id < 0 || id >= (model.kind === 'decorate' ? 12 : model.fruitRequired) || !inCookerySurface(point, .81)) return false
  const existing = model.fruit.find(fruit => fruit.id === id)
  if (existing) { existing.x = point.x; existing.y = point.y; return true }
  model.fruit.push({ id, x: point.x, y: point.y, angle: model.kind === 'decorate' ? (id % 3 - 1) * .12 : (id * 2.39996) % (Math.PI * 2) })
  if (model.fruit.length === model.fruitRequired) model.stage = model.kind === 'preserves' ? 'stir' : 'sprinkle'
  return true
}

export function rotateCookeryFruit(model: CookeryModel, id: number, angle: number): boolean {
  if (model.kind !== 'decorate' || !['fruit', 'sprinkle', 'ready'].includes(model.stage) || !Number.isFinite(angle)) return false
  const fruit = model.fruit.find(value => value.id === id)
  if (!fruit) return false
  fruit.angle = angle
  return true
}

export function beginCookeryStroke(model: CookeryModel, point: CookeryPoint): void {
  model.last = inCookerySurface(point, 1.05) ? { ...point } : null
}
export function endCookeryStroke(model: CookeryModel): void { model.last = null }

function segmentDistance(point: CookeryPoint, from: CookeryPoint, to: CookeryPoint): number {
  const dx = to.x - from.x, dy = to.y - from.y, length2 = dx * dx + dy * dy
  const t = length2 ? Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / length2)) : 0
  return Math.hypot(point.x - from.x - t * dx, point.y - from.y - t * dy)
}

/** Swept segments, rather than event counts, determine how much the player worked. */
export function moveCookeryStroke(model: CookeryModel, point: CookeryPoint): number {
  if ((model.stage !== 'stir' && model.stage !== 'sprinkle') || !inCookerySurface(point, 1.05)) { model.last = null; return 0 }
  const previous = model.last
  model.last = { ...point }
  if (!previous) return 0
  const distance = Math.hypot(point.x - previous.x, point.y - previous.y)
  if (distance < .005 || model.stage === 'stir' && distance > .85) return 0
  if (model.stage === 'stir') {
    if (Math.hypot(point.x, point.y) < .2 || Math.hypot(previous.x, previous.y) < .2) return 0
    const angle = Math.atan2(point.y, point.x), oldAngle = Math.atan2(previous.y, previous.x)
    const turn = Math.atan2(Math.sin(angle - oldAngle), Math.cos(angle - oldAngle))
    model.stirred = Math.min(STIR_REQUIRED, model.stirred + Math.abs(turn))
    const samples = Math.max(1, Math.ceil(Math.abs(turn) / .12))
    for (let i = 0; i <= samples; i++) {
      const sectorAngle = oldAngle + turn * i / samples
      model.stirSectors.add(Math.floor(((sectorAngle + Math.PI * 4) % (Math.PI * 2)) / (Math.PI * 2) * 16))
    }
    if (model.stirred >= STIR_REQUIRED && model.stirSectors.size >= 14) { model.stage = 'fill'; model.last = null }
  } else {
    model.sprinkleTravel += distance
    SPRINKLE_TARGETS.forEach((target, i) => { if (segmentDistance(target, previous, point) < .23) model.sprinkled.add(i) })
    if (model.sprinkled.size >= 20 && model.sprinkleTravel >= 5) { model.stage = 'ready'; model.last = null }
  }
  return distance
}

/** A scoop begins in the pot and has to reach the jar in the view adapter. */
export function fillCookeryJar(model: CookeryModel): boolean {
  if (model.stage !== 'fill') return false
  model.scoops++
  if (model.scoops >= SCOOPS_REQUIRED) model.stage = 'ready'
  return true
}

export function cookeryProgress(model: CookeryModel): number {
  if (model.stage === 'fruit') return model.fruit.length / model.fruitRequired
  if (model.stage === 'stir') return Math.min(model.stirred / STIR_REQUIRED, model.stirSectors.size / 14)
  if (model.stage === 'fill') return model.scoops / SCOOPS_REQUIRED
  if (model.stage === 'sprinkle') return Math.min(model.sprinkled.size / 20, model.sprinkleTravel / 5, 1)
  return model.stage === 'ready' || model.stage === 'finished' ? 1 : 0
}

/** Lock before calling the inventory transaction, including reentrant callbacks. */
export function completeCookery(model: CookeryModel, commit: () => boolean): boolean {
  if (model.stage !== 'ready') return false
  model.stage = 'committing'
  try {
    const accepted = commit()
    model.stage = accepted ? 'finished' : 'ready'
    return accepted
  } catch (error) { model.stage = 'ready'; throw error }
}
export function cancelCookery(model: CookeryModel): void {
  if (model.stage !== 'finished' && model.stage !== 'committing') { model.stage = 'cancelled'; model.last = null }
}

/** Stable flecks make reduced motion, resize and rendering recovery repeatable. */
export function cookeryParticle(index: number): { x: number; y: number; size: number; rotation: number } {
  let seed = (index + 1) * 2654435761 >>> 0
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296 }
  return { x: random() * 2 - 1, y: random() * 2 - 1, size: .7 + random() * .6, rotation: random() * Math.PI }
}

export type CookeryViewport = { width: number; height: number; stageWidth: number; stageHeight: number; compact: boolean }
export function cookeryViewport(width: number, height: number): CookeryViewport {
  const safeWidth = Math.max(1, width - 20), safeHeight = Math.max(1, height - 20)
  const panelWidth = Math.min(1180, safeWidth), panelHeight = Math.min(820, safeHeight)
  const compact = panelHeight < 420 || panelHeight < 600 && panelWidth > panelHeight
  return { width: panelWidth, height: panelHeight, stageWidth: panelWidth,
    stageHeight: Math.max(1, panelHeight - (compact ? 96 : 134)), compact }
}
