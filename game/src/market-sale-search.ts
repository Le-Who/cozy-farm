import { traitIds } from './climate.ts'
import { marketFamilyId, marketFamilyMatches } from './market-sale-family.ts'
import { traitLabel } from './ru.ts'
export type MarketSaleGroup = 'all' | 'harvest' | 'kitchen' | 'shore'
export type SaleListing = { key: string; name: string; count: number; group: string }
const searchable = (value: string) => value.normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').trim()
// Exact common plural forms for the raw goods, not fuzzy stems shared with dishes.
const pluralGoods: Readonly<Record<string, string>> = {
  'fruit:apple':'яблоки', 'fruit:pear':'груши', 'fruit:peach':'персики', eggs:'яйца',
}
const pluralTraits = new Map(traitIds.map(trait => [trait, searchable(traitLabel(trait)).slice(0, -2) + 'ые'] as const))
function pluralSaleTerms(key: string) {
  const family = marketFamilyId(key)
  const noun = family && Object.hasOwn(pluralGoods, family) ? pluralGoods[family] : undefined
  const [kind,,suffix] = key.split(':')
  const trait = noun && kind === 'variants' ? traitIds.find(id => id === suffix) : undefined
  return { noun, quality: trait && pluralTraits.get(trait) }
}


/** A view only: keep original keys, rarity, price, order and live stock. Never select by row index. */
export function searchMarketSales<T extends SaleListing>(stock: readonly T[], group: MarketSaleGroup, query: string, family?: string) {
  const words = searchable(query).split(/\s+/).filter(Boolean)
  const available = stock.filter(item => item.count > 0 && (group === 'all' || item.group === group) && (group!=='harvest' || !family || marketFamilyMatches(item.key,family)))
  const items = !words.length ? available : available.filter(item => {
    const name = searchable(item.name)
    if (words.every(word => name.includes(word))) return true
    const { noun, quality } = pluralSaleTerms(item.key)
    return words.every(word => name.includes(word) || word === noun || word === quality)
  })
  return { total: available.length, items }
}


/** Cross-category matches are a search result, never a change to the browse filter. */
export function searchMarketSaleView<T extends SaleListing>(stock: readonly T[], group: MarketSaleGroup, query: string, family?: string, crossCategory = false) {
  const current = searchMarketSales(stock, group, query, family)
  if (crossCategory && query.trim() && group !== 'all' && !current.items.length) {
    const all = searchMarketSales(stock, 'all', query)
    if (all.items.length) return { ...all, wholeSearch: true }
  }
  return { ...current, wholeSearch: false }
}

/** Name the exact visible SKU only; fuzzy/plural matches never choose an editor. */
export function namedMarketSaleQuantity<T extends SaleListing>(visible: readonly T[], query: string): T | undefined {
  const name = searchable(query)
  if (!name) return
  const exact = visible.filter(item => item.count > 0 && searchable(item.name) === name)
  return exact.length === 1 && exact[0].count > 1 ? exact[0] : undefined
}
