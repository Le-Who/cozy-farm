import { expeditionTrades, quoteExpedition, type FerryExpeditions, type ExpeditionWallet, type ExpeditionQuote } from './ferry-expeditions.ts'

/** A read-only escape from a cargo shortage, never a purchase or automatic selection. */
export function smallerFerryCargo(state: FerryExpeditions, id: string, wallet: ExpeditionWallet): ExpeditionQuote | undefined {
  const selected = quoteExpedition(state, id, wallet)
  if (!selected || selected.available || selected.kind !== 'trade' || state.active || !wallet.boatOwned
    || !state.discovered.includes(selected.port)
    || !selected.outgoing.some(item => (wallet.bag[item.id] ?? 0) < item.quantity)) return
  const units = selected.outgoing.reduce((sum, item) => sum + item.quantity, 0)
  for (const trade of expeditionTrades(state, selected.port)) {
    const quote = quoteExpedition(state, trade.id, wallet)!
    if (quote.available && quote.payCoins === 0 && quote.outgoing.length > 0
      && quote.outgoing.reduce((sum, item) => sum + item.quantity, 0) < units
      && quote.outgoing.every(item => selected.outgoing.some(cargo => cargo.id === item.id && cargo.quantity >= item.quantity))) return quote
  }
}
