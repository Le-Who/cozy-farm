import { getMarketBasket, getMarketOrders, getMarketStock, marketKey, sellMarketBasket, type ActionResult, type FarmState } from './farm.ts'

import { getMarketOrderBoard } from './market-orders-view.ts'

/** Preserve each currently actionable Home choice, not simultaneous delivery of shared stock. */
export function getMarketOrderSurplusQuote(farm: FarmState) {
  if (farm.island !== 'home') return
  const orders = getMarketOrders(farm)
  const ready = orders.filter(order => order.status === 'ready')
  const retained = new Map<string, number>()
  const choices = ready.map(order => {
    const needed = new Map<string, number>()
    for (const item of order.items) {
      const key = marketKey(item)
      needed.set(key, (needed.get(key) ?? 0) + item.quantity)
    }
    for (const [key, amount] of needed) retained.set(key, Math.max(retained.get(key) ?? 0, amount))
    return [order.lane, farm.orders[order.lane].completed, [...needed]]
  })
  const market = getMarketStock(farm), carried = new Map(market.map(row => [row.key, row.count]))
  // Orders already proves that every missing unit is available through Home's existing
  // pickup flow. Protect only the carried part; a market sale never touches that depot.
  const candidates = farm.boatOwned ? orders.filter(order => order.status === 'waiting' &&
    order.items.some(item => (carried.get(marketKey(item)) ?? 0) > 0)) : []
  const local = candidates.length
    ? new Set(getMarketOrderBoard(farm).choices.filter(order => order.group === 'warehouse').map(order => order.id)) : undefined
  const warehouseChoices: typeof choices = []
  let includesWarehouse = false
  for (const order of candidates) {
    if (!local?.has(order.lane)) continue
    const keys = order.items.map(marketKey)
    if (new Set(keys).size !== keys.length) continue
    const bag = order.items.flatMap((item, i) => {
      const key = keys[i], amount = Math.min(item.quantity, carried.get(key) ?? 0)
      return amount > 0 ? [[key, amount] as [string, number]] : []
    })
    for (const [key, amount] of bag) if (amount > (retained.get(key) ?? 0)) {
      retained.set(key, amount)
      includesWarehouse = true
    }
    if (bag.length) warehouseChoices.push([order.lane, farm.orders[order.lane].completed, bag])
  }
  for (const [key, amount] of retained) {
    if (!Number.isSafeInteger(amount) || amount < 1 || (carried.get(key) ?? 0) < amount) return
  }
  const requests = market.flatMap(({key,count}) => {
    const extra = count - (retained.get(key) ?? 0)
    return extra > 0 ? [{key,quantity:extra}] : []
  })
  const basket = getMarketBasket(farm, requests)
  const kept = [...retained.values()].reduce((sum, quantity) => sum + quantity, 0)
  if (!basket || !kept || !Number.isSafeInteger(kept)) return
  const token = JSON.stringify(includesWarehouse
    ? ['order-surplus-v2', choices, warehouseChoices, basket.token]
    : ['order-surplus-v1', choices, basket.token])
  return { token, kept, includesWarehouse, items: basket.items,
    total: basket.total, requests, basketToken: basket.token }
}

/** A quote is only a preview; only an explicit action applies a fresh exact basket. */
export function sellMarketOrderSurplus(farm: FarmState, token: unknown): ActionResult {
  const stale: ActionResult = {ok:false,message:'Заказы или запасы изменились. Проверьте, что можно продать.'}
  if (typeof token !== 'string' || token.length > 100_000) return stale
  const quote = getMarketOrderSurplusQuote(farm)
  return quote?.token === token ? sellMarketBasket(farm, quote.requests, quote.basketToken) : stale
}
