import { getMarketBasket, getMarketOrders, getMarketStock, marketKey, sellMarketBasket, type ActionResult, type FarmState } from './farm.ts'

/** Preserve the choice of any one ready order. Shared stock is not counted twice. */
export function getMarketOrderSurplusQuote(farm: FarmState) {
  if (farm.island !== 'home') return
  const ready = getMarketOrders(farm).filter(order => order.status === 'ready')
  if (!ready.length) return
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
  return { token: JSON.stringify(['order-surplus-v1', choices, basket.token]), kept, items: basket.items,
    total: basket.total, requests, basketToken: basket.token }
}

/** A quote is only a preview; only an explicit action applies a fresh exact basket. */
export function sellMarketOrderSurplus(farm: FarmState, token: unknown): ActionResult {
  const stale: ActionResult = {ok:false,message:'Заказы или запасы изменились. Проверьте, что можно продать.'}
  if (typeof token !== 'string' || token.length > 100_000) return stale
  const quote = getMarketOrderSurplusQuote(farm)
  return quote?.token === token ? sellMarketBasket(farm, quote.requests, quote.basketToken) : stale
}
