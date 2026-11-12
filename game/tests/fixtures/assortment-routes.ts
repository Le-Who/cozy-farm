import { assortmentPlayer } from './assortment-player.ts'
import * as C from '../../src/shop-commissions.ts'
import type { FarmState } from '../../src/farm.ts'

export function assortmentRoute(opening: { name: string; args: unknown[] }[], policy: 'jam' | 'tart' | 'set' | 'alternating', logistics: 'bag' | 'warehouse' | 'paused' = 'bag', onSnapshot?: (farm: FarmState) => void, orders = 12) {
  const a = assortmentPlayer(opening, onSnapshot), p = a.p
  const start = { day: p.state.day, coins: p.state.coins, commands: p.actions }
  const log: { order: number; kind: string; day: number; payment: number; premium: number; commands: number; coins: number }[] = []
  for (let order = 0; order < orders; order++) {
    if (p.state.shopCommissions.lastCompletedOn === p.state.day) p.night()
    p.visit('village')
    const kind = policy === 'alternating' ? (order % 2 ? 'jam' : 'set') : policy
    const offer = kind === 'set' ? C.getShopAssortment(p.state, 'bea', a.jam, a.tart)! : C.getShopCommissionOffers(p.state).find(offer => offer.customer === 'bea' && offer.recipeId === (kind === 'jam' ? a.jam : a.tart))!
    const commands = p.actions
    p.act('acceptShopCommission', offer.key)
    const serial = String(p.state.shopCommissions.serial)
    for (const line of C.getShopCommission(p.state)!.lines) {
      for (let n = 0; n < line.quantity; n++) {
        if (!(p.state.culinary.stock[line.recipeId] > 0)) a.cook(line.recipeId === a.jam ? 'preserves' : 'tart', line.recipeId)
        p.visit('village')
        if (logistics === 'warehouse') p.act('transferBayGoods', 'deposit', 'village', `signature:${line.recipeId}`, 1)
        p.act('deliverShopCommission', line.actionValue)
        if (logistics === 'paused' && n === 0) { for (let d = 0; d < 3; d++) p.night(); p.visit('village') }
      }
    }
    const view = C.getShopCommission(p.state)!, coins = p.state.coins
    p.act('finishShopCommission', serial)
    if (p.state.coins !== coins + view.total) throw Error('Wrong payment')
    log.push({ order: order + 1, kind, day: p.state.day, payment: view.total, premium: view.bonus, commands: p.actions - commands, coins: p.state.coins })
  }
  return { start, log, end: { day: p.state.day, coins: p.state.coins, commands: p.actions, completed: p.state.shopCommissions.completed.bea, version: p.state.shopCommissions.version }, state: p.state }
}
