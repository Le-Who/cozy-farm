import { seedPackSize, type ActionResult, type FarmState } from './farm.ts'
import { gardenPlanPreview } from './garden-plans.ts'
import { ruCount } from './ru.ts'

export type GardenSeedScope = 'open' | 'all'

/** A live quote, not a reservation. Full-plan supplies prepare one future sowing only. */
export function gardenSeedQuote(farm: FarmState, slot: number, scope: GardenSeedScope) {
  if (farm.island !== 'home' || !Number.isInteger(slot) || slot < 0 || slot > 3 || !['open', 'all'].includes(scope)) return
  const plan = farm.gardenPlans.pages[slot]
  if (!plan || farm.gardenPlans.revision >= 1_000_000) return
  const preview = gardenPlanPreview(farm, plan)
  const lines = preview.supplies.map(s => {
    const required = scope === 'all' ? s.planned : s.empty
    const missing = Math.max(0, required - s.stock)
    const packs = Math.ceil(missing / seedPackSize)
    return { crop: s.crop, required, stock: s.stock, missing, packs, seeds: packs * seedPackSize, cost: packs * s.price }
  })
  const total = lines.reduce((n, line) => n + line.cost, 0)
  const packs = lines.reduce((n, line) => n + line.packs, 0)
  // Include stock and required counts so changed occupancy or seed use cannot silently
  // turn an old click into a different purchase. The book revision prevents replay.
  const token = ['g1', farm.gardenPlans.revision, slot, scope, ...lines.map(s => `${s.crop},${s.required},${s.stock},${s.packs}`)].join(';')
  return { scope, token, lines, total, packs, seeds: packs * seedPackSize, affordable: farm.coins >= total }
}

/** Atomic purchase: never buys a partial basket, changes the field, or starts sowing. */
export function buyGardenSeeds(farm: FarmState, token: unknown): ActionResult {
  const stale = (): ActionResult => ({ ok: false, message: 'Список семян изменился. Откройте закупку заново и проверьте состав.' })
  if (typeof token !== 'string' || token.length > 1000) return stale()
  const head = /^g1;(0|[1-9]\d{0,5});([0-3]);(open|all);/.exec(token)
  if (!head || Number(head[1]) !== farm.gardenPlans.revision) return stale()
  const quote = gardenSeedQuote(farm, Number(head[2]), head[3] as GardenSeedScope)
  if (!quote || quote.token !== token) return stale()
  if (!quote.packs) return { ok: false, message: 'Для этой раскладки семена уже есть. Ничего покупать не нужно.' }
  if (!quote.affordable) return { ok: false, message: `На весь список нужно ${ruCount(quote.total, 'монета', 'монеты', 'монет')}. Пока ничего не куплено.` }
  farm.coins -= quote.total
  for (const line of quote.lines) farm.seeds[line.crop] += line.seeds
  farm.gardenPlans.revision++
  return { ok: true, message: `Куплено ${ruCount(quote.packs, 'пакет', 'пакета', 'пакетов')} семян за ${ruCount(quote.total, 'монету', 'монеты', 'монет')}. Семена в запасе; посадки и режим посева не изменились.` }
}
