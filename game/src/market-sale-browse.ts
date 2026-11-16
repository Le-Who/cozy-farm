import type { MarketSaleGroup } from './market-sale-search.ts'

type BrowseView = { family: string | undefined; scroll: number }

/** Ephemeral view memory only. Semantic families may be empty after a sale. */
export class MarketSaleBrowseMemory {
  private views = new Map<MarketSaleGroup, BrowseView>()

  change(from: MarketSaleGroup, to: MarketSaleGroup, current: BrowseView): BrowseView {
    // An explicit All choice starts over instead of reviving a hidden filter.
    if (to === 'all') { this.reset(); return { family: undefined, scroll: 0 } }
    this.views.set(from, { ...current })
    return { ...(this.views.get(to) ?? { family: undefined, scroll: 0 }) }
  }

  reset() { this.views.clear() }
}
