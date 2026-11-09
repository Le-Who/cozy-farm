export type FishPoint = { x: number; y: number }
export type FishStage = 'season' | 'transfer' | 'grill' | 'plate' | 'garnish' | 'ready' | 'committing' | 'finished' | 'cancelled'
export type FishGarnish = FishPoint & { id: number; angle: number }
export type FishModel = {
  stage: FishStage; salt: Float32Array; heat: [Float32Array, Float32Array]; side: 0 | 1;
  flipped: boolean; seconds: number; steps: string[]; garnish: FishGarnish[]; quiet: number;
}
const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v))
export function createFishModel(): FishModel {
  return { stage: 'season', salt: new Float32Array(12), heat: [new Float32Array(12), new Float32Array(12)], side: 0, flipped: false, seconds: 0, steps: [], garnish: [], quiet: 0 }
}
const finite = (point: FishPoint) => Number.isFinite(point.x) && Number.isFinite(point.y)
/** Salt is retained in fish coordinates; rubbing one spot cannot season the whole fish. */
export function seasonFish(model: FishModel, point: FishPoint, seconds: number, movement: number): boolean {
  if (model.stage !== 'season' || !finite(point) || !Number.isFinite(seconds) || seconds <= 0 || movement < .002) return false
  if (Math.abs(point.x) > .94 || Math.abs(point.y) > .62) return false
  const dt = Math.min(.06, seconds)
  for (let i = 0; i < 12; i++) {
    const x = (i % 6 - 2.5) * .28, y = (Math.floor(i / 6) - .5) * .52
    const d = ((point.x - x) / .30) ** 2 + ((point.y - y) / .38) ** 2
    model.salt[i] = clamp(model.salt[i] + Math.exp(-d * 1.5) * dt * 4.3)
  }
  return true
}
export function fishSaltCoverage(model: FishModel): number { return [...model.salt].filter(v => v >= .36).length / 12 }
export function finishFishSeason(model: FishModel): boolean {
  if (model.stage !== 'season' || fishSaltCoverage(model) < .83) return false
  model.stage = 'transfer'; model.steps.push('season-fish'); return true
}
export function placeFishInPan(model: FishModel): boolean {
  if (model.stage !== 'transfer') return false
  model.stage = 'grill'; return true
}
export function fishSideDone(model: FishModel, side: 0 | 1): number {
  return [...model.heat[side]].filter(v => v >= .74).length / 12
}
/** Continuous contact cooks a spatial field. Heat saturates gently, so there is no burn failure timer. */
export function heatFish(model: FishModel, seconds: number, contact: number, center: FishPoint): void {
  if (model.stage !== 'grill' || !finite(center) || !Number.isFinite(seconds) || seconds <= 0) return
  const dt = Math.min(.08, seconds), touching = clamp(contact)
  model.seconds += dt * touching
  for (let i = 0; i < 12; i++) {
    const x = center.x + (i % 6 - 2.5) * .20, y = center.y + (Math.floor(i / 6) - .5) * .28
    const hot = clamp(1 - (x * x * .30 + y * y * .25), .24, 1)
    const previous = model.heat[model.side][i]
    model.heat[model.side][i] = clamp(previous + dt * touching * hot * .15 * (1 - previous * .12))
  }
  const first = model.flipped ? 0 : model.side
  if (fishSideDone(model, first as 0 | 1) >= .9 && !model.steps.includes('grill-first-side')) model.steps.push('grill-first-side')
  if (model.flipped && fishSideDone(model, 0) >= .9 && fishSideDone(model, 1) >= .9 && !model.steps.includes('grill-second-side')) {
    model.steps.push('grill-second-side'); model.stage = 'plate'
  }
}
export function turnFish(model: FishModel): boolean {
  if (model.stage !== 'grill') return false
  model.side = model.side === 0 ? 1 : 0
  if (!model.flipped && model.steps.includes('grill-first-side')) { model.flipped = true; model.steps.push('turn-fish') }
  return true
}
export function plateFish(model: FishModel): boolean {
  if (model.stage !== 'plate') return false
  model.stage = 'garnish'; model.steps.push('plate-fish'); return true
}
export function placeFishGarnish(model: FishModel, id: number, point: FishPoint, angle: number): boolean {
  if (!['garnish', 'ready'].includes(model.stage) || !Number.isInteger(id) || id < 0 || id > 2 || !finite(point) || !Number.isFinite(angle)) return false
  if ((point.x / .87) ** 2 + (point.y / .72) ** 2 > 1 || point.y < .08) return false
  if (model.garnish.some(p => p.id !== id && Math.hypot(p.x - point.x, p.y - point.y) < .17)) return false
  const value = { id, ...point, angle: Math.atan2(Math.sin(angle), Math.cos(angle)) }, old = model.garnish.findIndex(p => p.id === id)
  if (old >= 0) model.garnish[old] = value; else model.garnish.push(value)
  model.quiet = 0; model.stage = 'garnish'; return true
}
export function settleFish(model: FishModel, seconds: number, quiet: boolean): void {
  if (model.stage !== 'garnish' || model.garnish.length !== 3) return
  model.quiet = quiet ? model.quiet + Math.max(0, Math.min(.1, seconds)) : 0
  if (model.quiet < .35) return
  if (!model.steps.includes('arrange-carrot')) model.steps.push('arrange-carrot')
  model.stage = 'ready'
}
export function completeFish(model: FishModel, commit: () => boolean): boolean {
  if (model.stage !== 'ready') return false
  model.stage = 'committing'
  try { if (commit()) { model.stage = 'finished'; return true } } catch { /* The parent retains inventory and permits a retry. */ }
  model.stage = 'ready'; return false
}
export function cancelFish(model: FishModel): boolean {
  if (model.stage === 'finished' || model.stage === 'committing' || model.stage === 'cancelled') return false
  model.stage = 'cancelled'; return true
}
export function fishProgress(model: FishModel): number {
  if (['ready','committing','finished'].includes(model.stage)) return 1
  if (model.stage === 'season') return fishSaltCoverage(model) * .2
  if (model.stage === 'transfer') return .2
  if (model.stage === 'grill') return .25 + ([...model.heat[0], ...model.heat[1]].reduce((s,v) => s + Math.min(.8,v),0) / 19.2) * .48
  if (model.stage === 'plate') return .75
  return .8 + model.garnish.length / 3 * .19
}
