import { MarketSeedPacks } from './market-seed-packs.ts'
import type { MarketSaleGroup } from './market-sale-search.ts'

type GridPosition = { key: string; scroll: number }
type BrowseView = { family: string | undefined; scroll: number }
type SellView = { island: string; group: MarketSaleGroup; family: string | undefined; query: string }

/** Ephemeral view memory only. Semantic families may be empty after a sale. */
export class MarketSaleBrowseMemory {
  private views = new Map<MarketSaleGroup, BrowseView>()

  private closed?: SellView & { scroll: number }
  private pausedTab?: GridPosition
  private pausedBuySeeds?: GridPosition
  readonly seedPacks = new MarketSeedPacks()
  private search?: { original?: GridPosition; refined: boolean }

  rememberClosed(view: SellView, scroll: number) {
    this.closed = { ...view, scroll }
  }

  takeClosed(view: SellView): number | undefined {
    const previous = this.closed
    this.closed = undefined
    return previous && previous.island === view.island && previous.group === view.group &&
      previous.family === view.family && previous.query === view.query ? previous.scroll : undefined
  }

  /** Only resume the Sell shelf if the same visit still shows the exact result list. */
  rememberTab(key: string, scroll: number) {
    this.pausedTab = { key, scroll }
  }

  takeTab(key: string | undefined): number | undefined {
    const previous = this.pausedTab
    this.pausedTab = undefined
    return previous && previous.key === key ? previous.scroll : undefined
  }

  /** A separate, one-use pause for the current open Market → Buy seeds. */
  rememberBuySeeds(key: string, scroll: number) {
    this.pausedBuySeeds = { key, scroll }
  }

  takeBuySeeds(key: string | undefined): number | undefined {
    const previous = this.pausedBuySeeds
    this.pausedBuySeeds = undefined
    return previous && previous.key === key ? previous.scroll : undefined
  }

  resetBuySeeds() { this.pausedBuySeeds = undefined; this.seedPacks.reset() }

  beginSearch(original?: GridPosition) { this.search ??= { original, refined: false } }
  refineSearch() { if (this.search) this.search.refined = true }
  get crossCategorySearch() { return this.search?.refined === false }
  finishSearch(): GridPosition | undefined {
    const previous = this.search
    this.search = undefined
    return previous?.refined === false ? previous.original : undefined
  }

  change(from: MarketSaleGroup, to: MarketSaleGroup, current: BrowseView): BrowseView {
    // An explicit All choice starts over instead of reviving a hidden filter.
    if (to === 'all') { this.resetPositions(); return { family: undefined, scroll: 0 } }
    this.views.set(from, { ...current })
    return { ...(this.views.get(to) ?? { family: undefined, scroll: 0 }) }
  }

  resetPositions() { this.views.clear(); this.closed = undefined; this.pausedTab = undefined }
  reset() { this.resetPositions(); this.resetBuySeeds(); this.search = undefined }
}
