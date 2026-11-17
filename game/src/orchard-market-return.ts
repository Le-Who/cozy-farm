type MarketVisit = { panel: string; marketTab: string; marketCategory: string }

/** A read-only shortcut through the exact space-making visit, not a saved mode. */
export function orchardMarketReturnIndex<T extends MarketVisit>(history: readonly T[], origin: T | undefined, panel: string | undefined, island: string) {
  if (!origin || island !== 'home' || panel !== 'orchard' && panel !== 'tree') return -1
  const index = history.indexOf(origin)
  if (index < 0 || origin.panel !== 'market' || origin.marketTab !== 'buy' || origin.marketCategory !== 'trees') return -1
  return history.slice(index + 1).every(visit => visit.panel === 'orchard' || visit.panel === 'tree') ? index : -1
}
