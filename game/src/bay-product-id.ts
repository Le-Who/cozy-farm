import type { StockItem } from './farm.ts'

export function bayProductId(item: StockItem): string {
  switch (item.kind) {
    case 'dishes': return 'dish:' + item.item
    case 'handmade': return 'handmade:' + item.item
    case 'variants': return 'variants:' + item.item + ':' + item.trait
    case 'shells': return item.item === 'regular' ? 'shells' : 'moon-shell'
    default: return 'item' in item ? item.item : item.kind
  }
}
