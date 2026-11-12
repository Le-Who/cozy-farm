import { cropDefinitions, cropIds, getBedStage, seedPackSize, type ActionResult, type CropId, type FarmState } from './farm.ts'

export const gardenPlanLimit = 4
export const gardenPlanBedCount = 16
export type GardenPlan = { name: string; crops: (CropId | null)[] }
export type GardenPlans = { revision: number; active: number | null; pages: (GardenPlan | null)[] }
export const createGardenPlans = (): GardenPlans => ({ revision: 0, active: null, pages: Array(gardenPlanLimit).fill(null) })
const isSlot = (v: unknown): v is number => Number.isInteger(v) && typeof v === 'number' && v >= 0 && v < gardenPlanLimit
const isCrop = (v: unknown): v is CropId => cropIds.some(id => id === v)
const validName = (v: unknown): v is string => typeof v === 'string' && v.trim() === v && v.length > 0 && v.length <= 36 && !/[<>\x00-\x1f]/.test(v)
const validCrops = (v: unknown): v is (CropId | null)[] => Array.isArray(v) && v.length === gardenPlanBedCount && v.every(c => c === null || isCrop(c)) && v.some(c => c !== null)
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

export function restoreGardenPlans(value: unknown): GardenPlans | undefined {
  if (value === undefined) return createGardenPlans()
  if (!record(value) || !Number.isSafeInteger(value.revision) || (value.revision as number) < 0 || (value.revision as number) > 1_000_000
    || !Array.isArray(value.pages) || value.pages.length !== gardenPlanLimit || value.active !== null && !isSlot(value.active)) return
  const pages: GardenPlans['pages'] = []
  for (const p of value.pages) {
    if (p === null) { pages.push(null); continue }
    if (!record(p) || !validName(p.name) || !validCrops(p.crops)) return
    pages.push({ name: p.name, crops: [...p.crops] })
  }
  if (value.active !== null && !pages[value.active as number] || value.revision === 0 && pages.some(Boolean)) return
  return { revision: value.revision as number, active: value.active as number | null, pages }
}

function mayEdit(farm: FarmState, revision: number): boolean {
  return farm.island === 'home' && farm.gardenPlans.revision === revision && revision < 1_000_000
}
const stale = (): ActionResult => ({ ok: false, message: 'План изменился. Откройте его заново на Родном острове.' })
export function saveGardenPlan(farm: FarmState, slot: number, draft: unknown, revision: number): ActionResult {
  if (!mayEdit(farm, revision)) return stale()
  if (!isSlot(slot) || !record(draft) || !validName(draft.name) || !validCrops(draft.crops)) return { ok: false, message: 'Дайте плану короткое имя и выберите хотя бы одну культуру.' }
  farm.gardenPlans.pages[slot] = { name: draft.name, crops: [...draft.crops] }
  farm.gardenPlans.revision++
  // Editing a plan cannot silently change a sowing instruction already in progress.
  if (farm.gardenPlans.active === slot) farm.gardenPlans.active = null
  return { ok: true, message: `План «${draft.name}» сохранён. Посадки, семена и монеты не изменились.` }
}
export function followGardenPlan(farm: FarmState, slot: number | null, revision: number): ActionResult {
  if (!mayEdit(farm, revision) || slot !== null && (!isSlot(slot) || !farm.gardenPlans.pages[slot])) return stale()
  if (farm.gardenPlans.active === slot) return { ok: false, message: slot === null ? 'Ручной посев уже включён.' : 'Этот план уже выбран.' }
  farm.gardenPlans.active = slot; farm.gardenPlans.revision++
  return { ok: true, message: slot === null ? 'Ручной посев: выбирайте семена как обычно. Планы остались в записной книжке.' : 'Посев по плану включён. На пустой грядке будет посеяна указанная культура. Каждое действие и каждый пакет семян остаются обычными.' }
}
export function removeGardenPlan(farm: FarmState, slot: number, revision: number): ActionResult {
  if (!mayEdit(farm, revision) || !isSlot(slot) || !farm.gardenPlans.pages[slot]) return stale()
  farm.gardenPlans.pages[slot] = null
  if (farm.gardenPlans.active === slot) farm.gardenPlans.active = null
  farm.gardenPlans.revision++
  return { ok: true, message: 'Запись удалена. На самом огороде ничего не изменилось.' }
}
export function activeGardenPlan(farm: Pick<FarmState, 'gardenPlans'>): GardenPlan | undefined {
  const book = farm.gardenPlans
  return book.active === null ? undefined : book.pages[book.active] ?? undefined
}
/** A plan is an explicit sowing mode, not an inventory reservation or a queue of actions. */
export function plannedCropAt(farm: Pick<FarmState, 'gardenPlans'>, index: number): CropId | undefined {
  return activeGardenPlan(farm)?.crops[index] ?? undefined
}
export function seedForBed(farm: Pick<FarmState, 'gardenPlans' | 'selectedSeed'>, index: number): CropId {
  return plannedCropAt(farm, index) ?? farm.selectedSeed
}
export function snapshotGarden(farm: Pick<FarmState, 'beds'>): (CropId | null)[] {
  return farm.beds.map(b => b.kind === 'crop' ? b.crop : null)
}

/** Current occupancy is authoritative. A different living crop is never cleared or harvested by a plan. */
export function gardenPlanPreview(farm: FarmState, plan: GardenPlan) {
  const beds = plan.crops.map((crop, index) => {
    const current = farm.beds[index]
    const status = crop === null ? 'free' as const : current.kind === 'crop'
      ? current.crop === crop ? 'matching' as const : 'occupied' as const
      : current.kind === 'empty' ? 'till' as const : farm.seeds[crop] > 0 ? 'ready' as const : 'seeds' as const
    return { index, crop, current, status, ripe: current.kind === 'crop' && getBedStage(current) === 'ripe' }
  })
  const supplies = cropIds.flatMap(crop => {
    const planned = plan.crops.filter(c => c === crop).length
    if (!planned) return []
    const growing = beds.filter(b => b.crop === crop && b.status === 'matching').length
    const waiting = beds.filter(b => b.crop === crop && b.status === 'occupied').length
    const empty = planned - growing - waiting
    const missing = Math.max(0, empty - farm.seeds[crop])
    return [{ crop, planned, growing, waiting, empty, stock: farm.seeds[crop], missing, packs: Math.ceil(missing / seedPackSize), price: cropDefinitions[crop].seedPrice, nights: cropDefinitions[crop].days }]
  })
  return { beds, supplies, matching: beds.filter(b => b.status === 'matching').length, planned: plan.crops.filter(Boolean).length,
    waiting: beds.filter(b => b.status === 'occupied').length, empty: beds.filter(b => ['ready', 'seeds', 'till'].includes(b.status)).length,
    missingCoins: supplies.reduce((n, s) => n + s.packs * s.price, 0) }
}
