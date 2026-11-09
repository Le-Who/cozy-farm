import { canSailTo, ingredientCount, islandIds, marketStock, type FarmState, type StockItem } from './farm.ts'
import { addFreightStock, consumeFreightStock, freightStock, takeFreightStock } from './bay-freight-model.ts'
import { BAY_MUSIC_EXPANSIONS } from './bay-music-model.ts'

export function bayProductId(item: StockItem): string {
  switch (item.kind) {
    case 'dishes': return 'dish:' + item.item
    case 'handmade': return 'handmade:' + item.item
    case 'variants': return 'variants:' + item.item + ':' + item.trait
    case 'shells': return item.item === 'regular' ? 'shells' : 'moon-shell'
    default: return 'item' in item ? item.item : item.kind
  }
}

const stockItems = new Map(marketStock.map(item => [bayProductId(item), item]))
export const openedFreightPorts = (farm: FarmState) => islandIds.filter(id => canSailTo(farm,id))

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
    if (!takeFreightStock(farm.freight,farm.island,id,count)) return {ok:false,message:'На складе недостаточно товара.'}
    changeBag(farm,id,count)
  }
  return {ok:true,message:direction==='deposit'?'Партия на складе.':'Партия в припасах.'}
}

export function reserveShopGoods(farm: FarmState, id: string, count: number): boolean {
  if (farm.island !== 'village' || !farm.village.built || !Number.isSafeInteger(count) || count < 1) return false
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
  if (farm.island==='village' && farm.village.built && next && consumeFreightStock(farm.freight,'village',next.materials)) {
    farm.musicGarden.level = next.level
    return next.level
  }
}
