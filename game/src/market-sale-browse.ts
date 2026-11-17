import type { MarketSaleGroup } from './market-sale-search.ts'

type BrowseView = { family: string | undefined; scroll: number }
type SellView = { island: string; group: MarketSaleGroup; family: string | undefined; query: string }

/** Ephemeral view memory only. Semantic families may be empty after a sale. */
export class MarketSaleBrowseMemory {
  private views = new Map<MarketSaleGroup, BrowseView>()

  private closed?: SellView & { scroll: number }

  rememberClosed(view: SellView, scroll: number) {
    this.closed = { ...view, scroll }
  }

  takeClosed(view: SellView): number | undefined {
    const previous = this.closed
    this.closed = undefined
    return previous && previous.island === view.island && previous.group === view.group &&
      previous.family === view.family && previous.query === view.query ? previous.scroll : undefined
  }

  change(from: MarketSaleGroup, to: MarketSaleGroup, current: BrowseView): BrowseView {
    // An explicit All choice starts over instead of reviving a hidden filter.
    if (to === 'all') { this.reset(); return { family: undefined, scroll: 0 } }
    this.views.set(from, { ...current })
    return { ...(this.views.get(to) ?? { family: undefined, scroll: 0 }) }
  }

  reset() { this.views.clear(); this.closed = undefined }
}
