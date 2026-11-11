import { canSailTo, ingredientCount, islandIds, marketStock, type FarmState, type StockItem } from './farm.ts'
import { addFreightStock, freightStock, takeFreightStock } from './bay-freight-model.ts'
import { noteFestivalDelivery } from './bay-festival.ts'
import { BAY_MUSIC_EXPANSIONS } from './bay-music-model.ts'
import { bayProductId } from './bay-product-id.ts'
import { dispatchExpedition, finishExpedition, quoteExpedition, type ExpeditionWallet } from './ferry-expeditions.ts'
export { bayProductId } from './bay-product-id.ts'

const stockItems = new Map(marketStock.map(item => [bayProductId(item), item]))
export const openedFreightPorts = (farm: FarmState) => islandIds.filter(id => canSailTo(farm,id))
export function expeditionWallet(farm: FarmState): ExpeditionWallet {
  return { harvestTier: farm.festivals.completed.harvest, boatOwned: farm.boatOwned, coins: farm.coins, bag: Object.fromEntries([...stockItems.keys()].map(id => [id, amount(farm, id)])) }
}

/** Resolve the current shortage, never a seed purchase or an automatic transfer. */
export function getFerrySupplyRequirement(farm: FarmState, offerId: string, itemId: string): { kind: 'stock'; item: StockItem } | undefined {
  if (!farm.boatOwned || farm.freight.expeditions.active) return
  const wallet = expeditionWallet(farm)
  const quote = quoteExpedition(farm.freight.expeditions, offerId, wallet)
  const cargo = quote?.outgoing.find(item => item.id === itemId && (wallet.bag[item.id] ?? 0) < item.quantity)
  const item = stockItems.get(itemId)
  return cargo && item ? { kind: 'stock', item: { ...item, quantity: cargo.quantity } } : undefined
}

export function sendFerryExpedition(farm: FarmState, id: string) {
  const result = dispatchExpedition(farm.freight.expeditions, id, farm.day, expeditionWallet(farm))
  if (!result.ok || !result.manifest) return result
  for (const item of result.manifest.outgoing) changeBag(farm, item.id, -item.quantity)
  farm.coins -= result.manifest.payCoins
  // The prototype's former circular route is retired, never a second active ferry.
  for (const item of farm.freight.ship.cargo) changeBag(farm, item.id, item.quantity)
  farm.freight.route.running = false
  farm.freight.ship = { phase: 'docked', port: 'home', cargo: [] }
  return { ok: true, message: result.message }
}

export function receiveFerryExpedition(farm: FarmState) {
  const manifest = finishExpedition(farm.freight.expeditions, farm.day)
  if (!manifest) return { ok: false, message: 'Паром ещё в пути.' }
  for (const item of manifest.incoming) {
    changeBag(farm, item.id, item.quantity)
    const entry = stockItems.get(item.id)
    if (entry?.kind === 'produce' || entry?.kind === 'fruit') (farm.discoveries[entry.item] ??= {}).regular = true
    if (entry?.kind === 'fruit' && !farm.bayDiscoveries.includes(entry.item)) farm.bayDiscoveries.push(entry.item)
    if (entry?.kind === 'dishes' && !farm.bayDiscoveries.includes(entry.item)) farm.bayDiscoveries.push(entry.item)
  }
  if (manifest.kind === 'trade') noteFestivalDelivery(farm.festivals, manifest.incoming.reduce((sum,item)=>sum+item.quantity,0))
  farm.coins += manifest.earnCoins
  return { ok: true, message: manifest.kind === 'explore' ? 'Новый порт открыт. Выберите его на карте.' : 'Груз и выручка в ваших припасах. У порта появились новые запасы.' }
}

function amount(farm: FarmState, id: string): number {
  const item = stockItems.get(id)
  if (item) return ingredientCount(farm,item)
  return id.startsWith('signature:') ? farm.culinary.stock[id.slice(10)] ?? 0 : 0
}

function changeBag(farm: FarmState, id: string, delta: number): boolean {
  if (!Number.isSafeInteger(delta) || amount(farm,id) + delta < 0) return false
  if (id.startsWith('signature:')) {
    const key = id.slice(10)
    if (!farm.culinary.recipes.some(recipe => recipe.id === key)) return false
    farm.culinary.stock[key] = (farm.culinary.stock[key] ?? 0) + delta
    return true
  }
  const item = stockItems.get(id)
  if (!item) return false
  switch (item.kind) {
    case 'produce': farm.produce[item.item] += delta; break
    case 'fruit': farm.fruit[item.item] += delta; break
    case 'fish': farm.fish[item.item] += delta; break
    case 'dishes': farm.dishes[item.item] += delta; break
    case 'handmade': farm.handmade[item.item] += delta; break
    case 'shells':
      farm.shells[item.item] += delta
      if (delta>0 && !farm.shellDiscoveries.includes(item.item)) farm.shellDiscoveries.push(item.item)
      break
    case 'shoalFinds': farm.shoalFinds[item.item] += delta; break
    case 'variants': {
      const variants = farm.variants[item.item] ??= {}
      const total = (variants[item.trait] ?? 0) + delta
      if (total) variants[item.trait] = total
      else delete variants[item.trait]
      break
    }
    default:
      farm[item.kind] += delta
      if(delta>0 && item.kind==='beeswax' && !farm.bayDiscoveries.includes('beeswax'))farm.bayDiscoveries.push('beeswax')
  }
  return true
}

export function transferBayGoods(farm: FarmState, direction: 'deposit'|'withdraw', port: string, id: string, count: number) {
  if (farm.island !== port || !canSailTo(farm, farm.island) || !Number.isSafeInteger(count) || count < 1)
    return {ok:false, message:'Подойдите к своему складу.'}
  if (!stockItems.has(id) && !farm.culinary.recipes.some(recipe => 'signature:'+recipe.id === id))
    return {ok:false, message:'Товар недоступен.'}
  if (direction === 'deposit') {
    if (amount(farm,id) < count || !addFreightStock(farm.freight, farm.island,id,count))
      return {ok:false,message:'Проверьте запас и свободное место на складе.'}
    changeBag(farm,id,-count)
  } else {
    if (id === 'beeswax' && (farm.capeLevel < 2 || farm.capeHoneyOn === 0)) return {ok:false,message:'Сначала откройте пасеку на Цветочном мысе. Воск остаётся на складе.'}
    if (!takeFreightStock(farm.freight,farm.island,id,count)) return {ok:false,message:'На складе недостаточно товара.'}
    changeBag(farm,id,count)
  }
  return {ok:true,message:direction==='deposit'?'Партия на складе.':'Партия в припасах.'}
}

export function reserveShopGoods(farm: FarmState, id: string, count: number): boolean {
  if (farm.island !== 'village' || !farm.village.built || !Number.isSafeInteger(count) || count < 1) return false
  if (!stockItems.has(id) && !farm.culinary.recipes.some(recipe => 'signature:'+recipe.id === id)) return false
  const local = Math.min(count,freightStock(farm.freight,'village',id))
  if (amount(farm,id) < count-local) return false
  if (local && !takeFreightStock(farm.freight,'village',id,local)) return false
  return count === local || changeBag(farm,id,local-count)
}

export function returnShopGoods(farm: FarmState, id: string, count: number) {
  if (Number.isSafeInteger(count) && count > 0) changeBag(farm,id,count)
}

export function installGardenInstrument(farm: FarmState): number | undefined {
  const next = BAY_MUSIC_EXPANSIONS.find(expansion => expansion.level === farm.musicGarden.level+1)
  if (farm.island==='village' && farm.village.built && next && next.materials.every(item => amount(farm,item.id) + freightStock(farm.freight,'village',item.id) >= item.quantity)) {
    for (const item of next.materials) {
      const local = Math.min(item.quantity, freightStock(farm.freight,'village',item.id))
      if (local) takeFreightStock(farm.freight,'village',item.id,local)
      if (item.quantity > local) changeBag(farm,item.id,local-item.quantity)
    }
    farm.musicGarden.level = next.level
    return next.level
  }
}

export function gardenMaterialStock(farm: FarmState): Record<string, number> {
  return Object.fromEntries(['shells','seaSalt','beeswax'].map(id => [id,amount(farm,id)+freightStock(farm.freight,'village',id)]))
}
