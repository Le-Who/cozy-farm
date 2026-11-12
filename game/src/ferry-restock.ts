import { advanceExpeditions, dispatchExpedition, expeditionOfferIds, expeditionStock, expeditionTrades, quoteExpedition, type ExpeditionPort, type ExpeditionQuote, type ExpeditionWallet, type FerryExpeditions } from './ferry-expeditions.ts'

type StockForecast = { id: string; needed: number; now: number; nextMorning: number }
export type FerryRestockPlan =
  | { kind: 'rest'; port: ExpeditionPort; day: number; stock: StockForecast[] }
  | { kind: 'supply'; port: ExpeditionPort; day: number; offer: ExpeditionQuote; complete: boolean; stock: (StockForecast & { afterDelivery: number })[] }

/** Preview the same arrival and production rules used by the next real morning. */
export function getFerryRestockPlan(state: FerryExpeditions, id: string, day: number, wallet: ExpeditionWallet): FerryRestockPlan | undefined {
  if (!wallet.boatOwned || state.active) return
  const request = quoteExpedition(state,id,wallet)
  if (!request || request.kind !== 'trade' || !state.discovered.includes(request.port)) return
  const choices = expeditionTrades(state,request.port)
  if (!expeditionOfferIds(id).every(selected => choices.some(offer=>offer.id===selected))) return
  const missing = request.incoming.filter(item => expeditionStock(state,request.port,item.id) < item.quantity)
  if (!missing.length) return
  const tomorrow = Math.max(day,state.lastDay) + 1
  const waiting = structuredClone(state)
  advanceExpeditions(waiting,tomorrow)
  // Production may consume an export that is sufficient now, so forecast
  // the whole requested basket rather than only today's missing items.
  const stock = request.incoming.map(item => ({id:item.id,needed:item.quantity,now:expeditionStock(state,request.port,item.id),nextMorning:expeditionStock(waiting,request.port,item.id)}))
  if (stock.every(item => item.nextMorning >= item.needed)) return {kind:'rest',port:request.port,day:tomorrow,stock}

  // The optional bought catch must not send a non-fishing player to catch fish
  // just because one morning grows only half a crate. A working kitchen may use
  // the next fish until its four-dish buffer fills, so simulate the real rules.
  if (expeditionOfferIds(id).includes('salt-fish')) {
    const future = structuredClone(waiting)
    for (let offset = 1; offset <= 5; offset++) {
      advanceExpeditions(future, tomorrow + offset)
      if (request.incoming.every(item => expeditionStock(future,request.port,item.id) >= item.quantity)) {
        return {kind:'rest',port:request.port,day:tomorrow+offset,stock:stock.map(item=>({...item,nextMorning:expeditionStock(future,request.port,item.id)}))}
      }
    }
  }

  const plans: Extract<FerryRestockPlan,{kind:'supply'}>[] = []
  for (const trade of expeditionTrades(state,request.port)) {
    if (trade.id === id || !trade.outgoing.length) continue
    const offer = quoteExpedition(state,trade.id,wallet)!
    // A preparation may need the player's supplies. Port stock, capacity and
    // unlock conditions are never relaxed; the displayed quote stays real.
    const previewWallet = { ...wallet, coins:Math.max(wallet.coins,offer.payCoins), bag:{...wallet.bag} }
    for (const item of offer.outgoing) previewWallet.bag[item.id] = Math.max(previewWallet.bag[item.id] ?? 0,item.quantity)
    const delivered = structuredClone(state)
    if (!dispatchExpedition(delivered,trade.id,day,previewWallet).ok) continue
    advanceExpeditions(delivered,tomorrow)
    // Credit only improvements caused by this delivery, not fruit or salt
    // that would have appeared anyway. Do not consume another needed export.
    if (!request.incoming.every(item => expeditionStock(delivered,request.port,item.id) >= Math.min(item.quantity,expeditionStock(waiting,request.port,item.id)))) continue
    const after = stock.map(item => ({...item,afterDelivery:expeditionStock(delivered,request.port,item.id)}))
    if (!after.some(item => Math.min(item.needed,item.afterDelivery) > Math.min(item.needed,item.nextMorning))) continue
    plans.push({kind:'supply',port:request.port,day:tomorrow,offer,complete:after.every(item=>item.afterDelivery>=item.needed),stock:after})
  }
  // Prefer a currently affordable useful delivery, then the smaller commitment.
  plans.sort((a,b) => Number(b.offer.available)-Number(a.offer.available)
    || a.offer.payCoins-b.offer.payCoins
    || a.offer.outgoing.reduce((sum,item)=>sum+item.quantity,0)-b.offer.outgoing.reduce((sum,item)=>sum+item.quantity,0))
  return plans[0]
}
