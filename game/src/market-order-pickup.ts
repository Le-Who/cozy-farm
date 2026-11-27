import { getMarketOrders, ingredientCount, restoreFarm, type FarmState, type StockItem } from './farm.ts'
import { consumeFreightStock } from './bay-freight-model.ts'
import { getLocalWarehouseSupply, withdrawWarehouseSupply } from './warehouse-guidance.ts'

type MarketOrder = ReturnType<typeof getMarketOrders>[number]
type SupplySource = typeof getLocalWarehouseSupply
type PickupItem = Exclude<StockItem, {kind:'shells'|'shoalFinds'|'variants'}>

const canUseForPickup = (item: StockItem): item is PickupItem =>
  // Keep withdrawals that can discover a resource on their existing individual route.
  item.kind !== 'shells' && item.kind !== 'shoalFinds' && item.kind !== 'variants' && item.kind !== 'beeswax'

/** Review one or two fully local shortages; all other paths keep their old tools. */
export function quoteMarketOrderPickup(farm: FarmState, order: MarketOrder, readSupply: SupplySource = getLocalWarehouseSupply) {
  if (farm.island !== 'home' || order.status !== 'waiting') return
  const missing = order.items.filter(item => ingredientCount(farm,item) < item.quantity)
  if (!missing.length || missing.length > 2) return
  const lines = []
  const ids = new Set<string>()
  for (const item of missing) {
    if (!canUseForPickup(item)) return
    const supply = readSupply(farm,item)
    if (!supply || supply.port !== 'home' || supply.carried + supply.quantity !== item.quantity || ids.has(supply.id)) return
    ids.add(supply.id)
    lines.push({ item, supply })
  }
  // Exact local identifiers are from the authored order catalogue, never a user title.
  const token = ['order-pickup1',farm.day,order.lane,farm.orders[order.lane].completed,
    ...lines.flatMap(({supply}) => [supply.id,supply.needed,supply.carried,supply.stored,supply.quantity])].join('|')
  return { lane:order.lane, lines, token }
}

function copyPreparedStock(farm: FarmState, prepared: FarmState, item: PickupItem) {
  switch (item.kind) {
    case 'produce': farm.produce[item.item] = prepared.produce[item.item]; break
    case 'fruit': farm.fruit[item.item] = prepared.fruit[item.item]; break
    case 'fish': farm.fish[item.item] = prepared.fish[item.item]; break
    case 'dishes': farm.dishes[item.item] = prepared.dishes[item.item]; break
    case 'handmade': farm.handmade[item.item] = prepared.handmade[item.item]; break
    default: farm[item.kind] = prepared[item.kind]
  }
}

export function pickUpMarketOrderStock(farm: FarmState, lane: string | undefined, expected: string | undefined) {
  const changed = () => ({ok:false,message:'Припасы изменились. Проверьте этот заказ.'})
  const order = getMarketOrders(farm).find(entry => entry.lane === lane)
  const quote = order && quoteMarketOrderPickup(farm,order)
  if (!quote || quote.token !== expected) return changed()
  // Verify both on a detached state through the existing transfer checks. A
  // failed line cannot alter the current save, payments or progress.
  const prepared = structuredClone(farm)
  for (const line of quote.lines) {
    if (!withdrawWarehouseSupply(prepared,line.item,line.supply).ok) return changed()
  }
  if (!restoreFarm(prepared) || getMarketOrders(prepared).find(entry => entry.lane === lane)?.status !== 'ready') return changed()
  // One existing all-or-nothing stock debit, then only the precomputed bag
  // cells. No live loop of gameplay actions and no whole-farm replacement.
  if (!consumeFreightStock(farm.freight,'home',quote.lines.map(({supply})=>({id:supply.id,quantity:supply.quantity})))) return changed()
  for (const {item} of quote.lines) copyPreparedStock(farm,prepared,item)
  return {ok:true,message:'Припасы собраны.'}
}
