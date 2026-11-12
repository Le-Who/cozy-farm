import { bayShopVisitors, type BayShopState, type BayShopVisitorId } from './bay-shop-model.ts'
import type { CulinaryState } from './culinary.ts'
import type { FarmState } from './farm.ts'
import { ruCount } from './ru.ts'

type SingleCommission = { serial: number; customer: BayShopVisitorId; recipeId: string; quantity: number; delivered: number; unitPrice: number; bonus: number; startedOn: number }
type SingleReceipt = { customer: BayShopVisitorId; recipeName: string; quantity: number; unitPrice: number; bonus: number; day: number }
type CommissionLine = { recipeId: string; quantity: number; delivered: number; unitPrice: number }
type MixedCommission = { serial: number; customer: BayShopVisitorId; lines: [CommissionLine, CommissionLine]; bonus: number; startedOn: number }
type ReceiptLine = { recipeName: string; quantity: number; unitPrice: number }
type MixedReceipt = { customer: BayShopVisitorId; lines: [ReceiptLine, ReceiptLine]; bonus: number; day: number }
type Commission = SingleCommission | MixedCommission
type Receipt = SingleReceipt | MixedReceipt
export type ShopCommissions = { version: 1 | 2; serial: number; completed: Record<BayShopVisitorId, number>; lastCompletedOn: number; active: Commission | null; last: Receipt | null }
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
/** The two bases require different preparation; cosmetic variations do not make a set. */
export function getShopAssortment(farm: FarmState, customer: unknown, firstId: unknown, secondId: unknown) {
  if (!customerId(customer) || farm.shopCommissions.completed[customer] < 2 || firstId === secondId) return undefined
  const offers = getShopCommissionOffers(farm).filter(offer => offer.customer === customer)
  const first = offers.find(offer => offer.recipeId === firstId), second = offers.find(offer => offer.recipeId === secondId)
  if (!first || !second) return undefined
  const a = farm.culinary.recipes.find(recipe => recipe.id === first.recipeId)!, b = farm.culinary.recipes.find(recipe => recipe.id === second.recipeId)!
  if (a.base === b.base) return undefined
  const lines = [first, second].sort((a, b) => a.recipeId.localeCompare(b.recipeId))
  return { key: `set:${customer}:${lines[0].recipeId}:${lines[1].recipeId}:${first.completed}:${farm.day}`, customer,
    customerName: first.customerName, lines: lines.map(line => ({ recipeId: line.recipeId, recipeName: line.recipeName, quantity: 2, unitPrice: line.unitPrice })),
    bonus: 12, total: 2 * (first.unitPrice + second.unitPrice) + 12 }
}
const commissionLines = (active: Commission): CommissionLine[] => 'lines' in active ? active.lines : [active]
export function shopCommissionUsesRecipe(state: ShopCommissions, id: string) { return !!state.active && commissionLines(state.active).some(line => line.recipeId === id) }
// The old reader must refuse a mixed escrow or receipt, never silently drop its second line.
// Once only legacy-shaped data remains, exact old-reader compatibility is restored.
function updateVersion(state: ShopCommissions) {
  state.version = (state.active && 'lines' in state.active) || (state.last && 'lines' in state.last) ? 2 : 1
}
export function getShopCommission(farm: FarmState) {
  const active = farm.shopCommissions.active
  if (!active) return undefined
  const lines = commissionLines(active).map(line => {
    const recipe = farm.culinary.recipes.find(recipe => recipe.id === line.recipeId)!
    const warehouse = farm.freight.warehouses.village[`signature:${recipe.id}`] ?? 0
    const inBag = farm.culinary.stock[recipe.id] ?? 0, remaining = line.quantity - line.delivered
    return { ...line, recipeName: recipe.name, inBag, warehouse, remaining,
      actionValue: 'lines' in active ? `${active.serial}:${recipe.id}` : String(active.serial),
      canDeliver: farm.island === 'village' && remaining > 0 && inBag + warehouse > 0 }
  })
  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0), delivered = lines.reduce((sum, line) => sum + line.delivered, 0)
  return { serial: active.serial, customer: active.customer, startedOn: active.startedOn, bonus: active.bonus, lines,
    mixed: 'lines' in active, recipeName: lines.length === 1 ? lines[0].recipeName : 'Набор из двух рецептов',
    customerName: bayShopVisitors.find(person => person.id === active.customer)!.name, quantity, delivered, remaining: quantity - delivered,
    total: lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, active.bonus),
    canDeliver: lines.some(line => line.canDeliver), canClaim: farm.island === 'village' && quantity === delivered }
}
export function getShopCommissionLine(farm: FarmState, value: string | undefined) {
  const view = getShopCommission(farm)
  return view?.lines.find(line => line.actionValue === value)
}
export function acceptShopCommission(farm: FarmState, key: string | undefined) {
  const offer = getShopCommissionOffers(farm).find(offer => offer.key === key)
  const parts = key?.split(':') ?? []
  const mixed = parts.length === 6 && parts[0] === 'set' ? getShopAssortment(farm, parts[1], parts[2], parts[3]) : undefined
  if (farm.island !== 'village' || !offer && (!mixed || mixed.key !== key) || farm.day >= Number.MAX_SAFE_INTEGER) return failure('Выберите доступный заказ в лавке гавани.')
  const state = farm.shopCommissions
  state.serial++
  state.active = offer ? { serial: state.serial, customer: offer.customer, recipeId: offer.recipeId, quantity: offer.quantity, delivered: 0,
    unitPrice: offer.unitPrice, bonus: offer.bonus, startedOn: farm.day }
    : { serial: state.serial, customer: mixed!.customer, lines: mixed!.lines.map(line => ({ recipeId: line.recipeId, quantity: 2, delivered: 0, unitPrice: line.unitPrice })) as [CommissionLine, CommissionLine], bonus: 12, startedOn: farm.day }
  updateVersion(state)
  return success('Заказ записан. Собирайте партию в своём темпе. Покупатель заберёт её, когда она будет готова. Срока нет.')
}
export function deliverShopCommission(farm: FarmState, value: string | undefined) {
  const line = getShopCommissionLine(farm, value), state = farm.shopCommissions
  if (!line?.canDeliver) return failure('Проверьте заказ и готовые порции в припасах или на складе гавани.')
  if (!Number.isSafeInteger(farm.workToday + 1)) return failure('Журнал работ заполнен.')
  // One named portion: warehouse first, then the bag. Shop shelves are separate stock.
  const id = `signature:${line.recipeId}`, warehouse = farm.freight.warehouses.village
  if (line.warehouse > 0) { warehouse[id]--; if (!warehouse[id]) delete warehouse[id] }
  else farm.culinary.stock[line.recipeId]--
  commissionLines(state.active!).find(part => part.recipeId === line.recipeId)!.delivered++; farm.workToday++
  return success('Одна порция отложена для покупателя. Оплата будет за всю готовую партию.')
}
export function cancelShopCommission(farm: FarmState, serial: string | undefined) {
  const active = farm.shopCommissions.active
  if (farm.island !== 'village' || !active || serial !== String(active.serial)) return failure('Этот заказ уже изменился.')
  const returns = commissionLines(active).map(line => ({ recipeId: line.recipeId, count: (farm.culinary.stock[line.recipeId] ?? 0) + line.delivered }))
  if (returns.some(line => !integer(line.count))) return failure('В припасах нет места для возврата партии. Освободите место и повторите.')
  for (const line of returns) farm.culinary.stock[line.recipeId] = line.count
  farm.shopCommissions.active = null; updateVersion(farm.shopCommissions)
  return success('Заказ отменён. Все отложенные порции возвращены в припасы; награда не выдана.')
}
export function finishShopCommission(farm: FarmState, serial: string | undefined) {
  const view = getShopCommission(farm), state = farm.shopCommissions
  if (!view?.canClaim || serial !== String(view.serial)) return failure('Подготовьте всю партию и вернитесь в гавань за оплатой.')
  if (!Number.isSafeInteger(farm.coins + view.total) || !Number.isSafeInteger(farm.workToday + 1) || state.completed[view.customer] >= max) return failure('Журнал заказов заполнен.')
  farm.coins += view.total; farm.workToday++
  state.completed[view.customer]++; state.lastCompletedOn = farm.day
  state.last = view.mixed ? { customer: view.customer, lines: view.lines.map(line => ({ recipeName: line.recipeName, quantity: line.quantity, unitPrice: line.unitPrice })) as [ReceiptLine, ReceiptLine], bonus: view.bonus, day: farm.day }
    : { customer: view.customer, recipeName: view.recipeName, quantity: view.quantity, unitPrice: view.lines[0].unitPrice, bonus: view.bonus, day: farm.day }
  state.active = null; updateVersion(state)
  return success(`${view.customerName} забирает «${view.recipeName}». Получено ${ruCount(view.total, 'монета', 'монеты', 'монет')}. Новый заказ можно выбрать следующим утром.`)
}

/** Absent legacy data starts empty; malformed present data cannot erase a committed batch. */
export function restoreShopCommissions(value: unknown, day: number, culinary: CulinaryState, shop: BayShopState, built: boolean): ShopCommissions | undefined {
  if (value === undefined) return createShopCommissions()
  if (!record(value) || (value.version !== 1 && value.version !== 2) || !integer(value.serial) || !record(value.completed)
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
    if (!record(last) || !customerId(last.customer) || state.completed[last.customer] === 0 || last.day !== value.lastCompletedOn) return
    const validReceiptLine = (line: unknown): line is ReceiptLine => record(line) && typeof line.recipeName === 'string'
      && !!line.recipeName.trim() && line.recipeName.length <= 32 && !/[<>\x00-\x1f]/.test(line.recipeName) && integer(line.unitPrice, 1000) && line.unitPrice >= 1
    if ('lines' in last) {
      if (value.version !== 2 || state.completed[last.customer] < 3 || last.bonus !== 12 || !Array.isArray(last.lines) || last.lines.length !== 2
        || !last.lines.every(line => validReceiptLine(line) && line.quantity === 2)) return
      state.last = { customer: last.customer, lines: last.lines.map(line => ({ recipeName: line.recipeName, quantity: 2, unitPrice: line.unitPrice })) as [ReceiptLine, ReceiptLine], bonus: 12, day: value.lastCompletedOn }
    } else {
      const customer = last.customer, bonus = last.bonus
      if (!validReceiptLine(last)) return
      const expected = terms(state.completed[customer] - 1)
      if (last.quantity !== expected.quantity || bonus !== expected.bonus) return
      state.last = { customer, recipeName: last.recipeName, quantity: expected.quantity, unitPrice: last.unitPrice, bonus: expected.bonus, day: value.lastCompletedOn }
    }
  } else if (total > 0) return
  if (value.active !== null) {
    const active = value.active
    if (!record(active) || !customerId(active.customer) || active.serial !== value.serial || total >= value.serial
      || !integer(active.startedOn, day) || active.startedOn <= value.lastCompletedOn) return
    const customer = active.customer
    if ('lines' in active) {
      if (value.version !== 2 || state.completed[customer] < 2 || active.bonus !== 12 || !Array.isArray(active.lines) || active.lines.length !== 2) return
      const lines: CommissionLine[] = []
      for (const line of active.lines) {
        if (!record(line)) return
        const recipe = culinary.recipes.find(recipe => recipe.id === line.recipeId)
        if (!recipe || !liked(shop, customer, recipe.id) || line.quantity !== 2 || line.unitPrice !== recipe.sellPrice || !integer(line.delivered, 2)) return
        lines.push({ recipeId: recipe.id, quantity: 2, delivered: line.delivered, unitPrice: recipe.sellPrice })
      }
      if (lines[0].recipeId.localeCompare(lines[1].recipeId) >= 0 || culinary.recipes.find(recipe => recipe.id === lines[0].recipeId)!.base === culinary.recipes.find(recipe => recipe.id === lines[1].recipeId)!.base) return
      state.active = { serial: value.serial, customer, lines: lines as [CommissionLine, CommissionLine], bonus: 12, startedOn: active.startedOn }
    } else {
      const recipe = culinary.recipes.find(recipe => recipe.id === active.recipeId), expected = terms(state.completed[customer])
      if (!recipe || !liked(shop, customer, recipe.id) || active.unitPrice !== recipe.sellPrice
        || active.quantity !== expected.quantity || active.bonus !== expected.bonus || !integer(active.delivered, expected.quantity)) return
      state.active = { serial: value.serial, customer, recipeId: recipe.id, quantity: expected.quantity, delivered: active.delivered,
        unitPrice: recipe.sellPrice, bonus: expected.bonus, startedOn: active.startedOn }
    }
  }
  updateVersion(state)
  if (state.version !== value.version) return
  if (!built && (value.serial !== 0 || total > 0 || state.active || state.last)) return
  state.serial = value.serial; state.lastCompletedOn = value.lastCompletedOn
  return state
}
