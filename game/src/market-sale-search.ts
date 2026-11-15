import { marketFamilyId } from './market-sale-family.ts'
export type MarketSaleGroup = 'all' | 'harvest' | 'kitchen' | 'shore'
export type SaleListing = { key: string; name: string; count: number; group: string }
const searchable = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').trim()

/** A view only: keep original keys, rarity, price, order and live stock. Never select by row index. */
export function searchMarketSales<T extends SaleListing>(stock: readonly T[], group: MarketSaleGroup, query: string, family?: string) {
  const words = searchable(query).split(/\s+/).filter(Boolean)
  const available = stock.filter(item => item.count > 0 && (group === 'all' || item.group === group) && (group!=='harvest' || !family || marketFamilyId(item.key)===family))
  return { total: available.length, items: available.filter(item => words.every(word => searchable(item.name).includes(word))) }
}
