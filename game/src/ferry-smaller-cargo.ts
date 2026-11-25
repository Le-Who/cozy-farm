import { expeditionOfferIds, expeditionTrades, quoteExpedition, type ExpeditionPort, type FerryExpeditions, type ExpeditionWallet, type ExpeditionQuote } from './ferry-expeditions.ts'
import { getFerryRestockPlan } from './ferry-restock.ts'

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

/** A first trip can be prepared through its existing quote without paying coins or waiting. */
export function hasFirstFerryCargo(state: FerryExpeditions, day: number, wallet: ExpeditionWallet, port: ExpeditionPort, offer: string): boolean {
  if (state.serial !== 0 || state.active || state.last || !wallet.boatOwned || !state.discovered.includes(port)) return false
  const ids = expeditionOfferIds(offer), choices = expeditionTrades(state, port)
  if (!ids.length || !ids.every(id => choices.some(choice => choice.id === id))) return false
  const quote = quoteExpedition(state, offer, wallet)
  if (quote?.available) return quote.payCoins === 0 && quote.outgoing.length > 0
  return !!smallerFerryCargo(state, offer, wallet) && !getFerryRestockPlan(state, offer, day, wallet)
}
