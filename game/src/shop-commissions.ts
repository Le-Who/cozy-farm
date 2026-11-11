import { bayShopVisitors, type BayShopState, type BayShopVisitorId } from './bay-shop-model.ts'
import type { CulinaryState } from './culinary.ts'
import type { FarmState } from './farm.ts'
import { ruCount } from './ru.ts'

type Commission = { serial: number; customer: BayShopVisitorId; recipeId: string; quantity: number; delivered: number; unitPrice: number; bonus: number; startedOn: number }
type Receipt = { customer: BayShopVisitorId; recipeName: string; quantity: number; unitPrice: number; bonus: number; day: number }
export type ShopCommissions = { version: 1; serial: number; completed: Record<BayShopVisitorId, number>; lastCompletedOn: number; active: Commission | null; last: Receipt | null }
const max = 1_000_000
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const integer = (value: unknown, upper = max): value is number => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= upper
const customerId = (value: unknown): value is BayShopVisitorId => bayShopVisitors.some(person => person.id === value)
const terms = (completed: number) => ({ quantity: 2 + Math.min(2, completed), bonus: 6 + 3 * Math.min(2, completed) })
const liked = (shop: BayShopState, customer: BayShopVisitorId, recipeId: string) => (shop.memories[customer].purchases[`signature:${recipeId}`]?.liked ?? 0) > 0
const failure = (message: string) => ({ ok: false, message })
const success = (message: string) => ({ ok: true, message })
export function createShopCommissions(): ShopCommissions {
  return { version: 1, serial: 0, completed: Object.fromEntries(bayShopVisitors.map(person => [person.id, 0])) as ShopCommissions['completed'], lastCompletedOn: 0, active: null, last: null }
}

/** A liked, actual shop purchase earns an offer. Names and unsold shelves never do. */
export function getShopCommissionOffers(farm: FarmState) {
  const state = farm.shopCommissions
  if (!farm.village.built || state.active || state.serial >= max || state.lastCompletedOn === farm.day) return []
  return bayShopVisitors.flatMap(person => farm.culinary.recipes.filter(recipe => liked(farm.bayShop, person.id, recipe.id)).map(recipe => {
    const completed = state.completed[person.id], { quantity, bonus } = terms(completed)
    return { key: `${person.id}:${recipe.id}:${completed}:${farm.day}`, customer: person.id, customerName: person.name,
      recipeId: recipe.id, recipeName: recipe.name, completed, quantity, unitPrice: recipe.sellPrice, bonus, total: quantity * recipe.sellPrice + bonus }
  }))
}
export function getShopCommission(farm: FarmState) {
  const active = farm.shopCommissions.active
  if (!active) return undefined
  const recipe = farm.culinary.recipes.find(recipe => recipe.id === active.recipeId)
  if (!recipe) return undefined
  const warehouse = farm.freight.warehouses.village[`signature:${recipe.id}`] ?? 0
  const inBag = farm.culinary.stock[recipe.id] ?? 0, remaining = active.quantity - active.delivered
  return { ...active, recipeName: recipe.name, customerName: bayShopVisitors.find(person => person.id === active.customer)!.name,
    inBag, warehouse, remaining, total: active.quantity * active.unitPrice + active.bonus,
    canDeliver: farm.island === 'village' && remaining > 0 && inBag + warehouse > 0,
    canClaim: farm.island === 'village' && remaining === 0 }
}
export function acceptShopCommission(farm: FarmState, key: string | undefined) {
  const offer = getShopCommissionOffers(farm).find(offer => offer.key === key)
  if (farm.island !== 'village' || !offer || farm.day >= Number.MAX_SAFE_INTEGER) return failure('Выберите доступный заказ в лавке гавани.')
  const state = farm.shopCommissions
  state.serial++
  state.active = { serial: state.serial, customer: offer.customer, recipeId: offer.recipeId, quantity: offer.quantity, delivered: 0,
    unitPrice: offer.unitPrice, bonus: offer.bonus, startedOn: farm.day }
  return success('Заказ записан. Собирайте партию в своём темпе. Покупатель заберёт её, когда она будет готова. Срока нет.')
}
export function deliverShopCommission(farm: FarmState, serial: string | undefined) {
  const view = getShopCommission(farm), state = farm.shopCommissions
  if (!view?.canDeliver || serial !== String(view.serial)) return failure('Проверьте заказ и готовые порции в припасах или на складе гавани.')
  if (!Number.isSafeInteger(farm.workToday + 1)) return failure('Журнал работ заполнен.')
  // One explicit portion: warehouse first, then the bag. Ordinary shelves remain the shop's stock.
  const id = `signature:${view.recipeId}`, warehouse = farm.freight.warehouses.village
  if (view.warehouse > 0) { warehouse[id]--; if (!warehouse[id]) delete warehouse[id] }
  else farm.culinary.stock[view.recipeId]--
  state.active!.delivered++; farm.workToday++
  return success('Одна порция отложена для покупателя. Оплата будет за всю готовую партию.')
}
export function cancelShopCommission(farm: FarmState, serial: string | undefined) {
  const active = farm.shopCommissions.active
  if (farm.island !== 'village' || !active || serial !== String(active.serial)) return failure('Этот заказ уже изменился.')
  const count = (farm.culinary.stock[active.recipeId] ?? 0) + active.delivered
  if (!integer(count)) return failure('В припасах нет места для возврата партии. Освободите место и повторите.')
  farm.culinary.stock[active.recipeId] = count
  farm.shopCommissions.active = null
  return success('Заказ отменён. Все отложенные порции возвращены в припасы; награда не выдана.')
}
export function finishShopCommission(farm: FarmState, serial: string | undefined) {
  const view = getShopCommission(farm), state = farm.shopCommissions
  if (!view?.canClaim || serial !== String(view.serial)) return failure('Подготовьте всю партию и вернитесь в гавань за оплатой.')
  if (!Number.isSafeInteger(farm.coins + view.total) || !Number.isSafeInteger(farm.workToday + 1) || state.completed[view.customer] >= max) return failure('Журнал заказов заполнен.')
  farm.coins += view.total; farm.workToday++
  state.completed[view.customer]++; state.lastCompletedOn = farm.day
  state.last = { customer: view.customer, recipeName: view.recipeName, quantity: view.quantity, unitPrice: view.unitPrice, bonus: view.bonus, day: farm.day }
  state.active = null
  return success(`${view.customerName} забирает «${view.recipeName}». Получено ${ruCount(view.total, 'монета', 'монеты', 'монет')}. Новый заказ можно выбрать следующим утром.`)
}

/** Absent legacy data starts empty; malformed present data cannot erase a committed batch. */
export function restoreShopCommissions(value: unknown, day: number, culinary: CulinaryState, shop: BayShopState, built: boolean): ShopCommissions | undefined {
  if (value === undefined) return createShopCommissions()
  if (!record(value) || value.version !== 1 || !integer(value.serial) || !record(value.completed)
    || Object.keys(value.completed).length !== bayShopVisitors.length || !integer(value.lastCompletedOn, day)) return
  const state = createShopCommissions()
  for (const person of bayShopVisitors) {
    const count = value.completed[person.id]
    if (!integer(count, Math.min(max, day))) return
    state.completed[person.id] = count
  }
  const total = Object.values(state.completed).reduce((sum, count) => sum + count, 0)
  if (total > value.serial || total > value.lastCompletedOn || (total === 0) !== (value.lastCompletedOn === 0)) return
  if (value.last !== null) {
    const last = value.last
    if (!record(last) || !customerId(last.customer) || state.completed[last.customer] === 0 || last.day !== value.lastCompletedOn
      || typeof last.recipeName !== 'string' || !last.recipeName.trim() || last.recipeName.length > 32 || /[<>\x00-\x1f]/.test(last.recipeName)
      || !integer(last.unitPrice, 1000) || last.unitPrice < 1) return
    const expected = terms(state.completed[last.customer] - 1)
    if (last.quantity !== expected.quantity || last.bonus !== expected.bonus) return
    state.last = { customer: last.customer, recipeName: last.recipeName, quantity: expected.quantity, unitPrice: last.unitPrice, bonus: expected.bonus, day: value.lastCompletedOn }
  } else if (total > 0) return
  if (value.active !== null) {
    const active = value.active
    if (!record(active) || !customerId(active.customer) || active.serial !== value.serial || total >= value.serial
      || typeof active.recipeId !== 'string' || !integer(active.startedOn, day) || active.startedOn <= value.lastCompletedOn) return
    const recipe = culinary.recipes.find(recipe => recipe.id === active.recipeId), expected = terms(state.completed[active.customer])
    if (!recipe || !liked(shop, active.customer, recipe.id) || active.unitPrice !== recipe.sellPrice
      || active.quantity !== expected.quantity || active.bonus !== expected.bonus || !integer(active.delivered, expected.quantity)) return
    state.active = { serial: value.serial, customer: active.customer, recipeId: recipe.id, quantity: expected.quantity, delivered: active.delivered,
      unitPrice: recipe.sellPrice, bonus: expected.bonus, startedOn: active.startedOn }
  }
  if (!built && (value.serial !== 0 || total > 0 || state.active || state.last)) return
  state.serial = value.serial; state.lastCompletedOn = value.lastCompletedOn
  return state
}
