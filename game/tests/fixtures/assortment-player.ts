import { commissionPlayer } from './commission-player.ts'
import * as F from '../../src/farm.ts'
import * as C from '../../src/shop-commissions.ts'
import { removeBayShopStock, bayShopDailyLimit } from '../../src/bay-shop-model.ts'

/** A wider menu earned through field work, chicken care, cooking and real shop purchases. */
export function assortmentPlayer(opening: { name: string; args: unknown[] }[], onSnapshot?: (farm: F.FarmState) => void) {
  const p = commissionPlayer(opening, onSnapshot)
  function wheat() {
    p.visit('home')
    for (let attempt = 0; p.state.produce.wheat < 1; attempt++) {
      if (attempt > 10) throw Error('Wheat did not grow')
      if (F.getBedStage(p.state.beds[0]) === 'ripe') p.act('workBed', 0)
      if (p.state.produce.wheat) break
      if (p.state.beds[0].kind === 'tilled') {
        if (!p.state.seeds.wheat) p.act('buySeeds', 'wheat')
        if (p.state.selectedSeed !== 'wheat') p.act('selectSeed', 'wheat')
        p.act('workBed', 0)
      }
      if (F.getBedAction(p.state, 0).kind === 'water') {
        if (!p.state.water) p.act('refillWater')
        p.act('workBed', 0)
      }
      p.night()
    }
  }
  function egg() {
    p.visit('home')
    if (p.state.eggs) return
    if (!p.state.eggsReady) {
      if (!p.state.feed) p.act('buyFeed')
      if (!p.state.chickensFed) p.act('feedChickens')
      p.night()
    }
    p.act('collectEggs')
  }
  function cook(base: 'preserves' | 'tart', recipeId?: string) {
    if (base === 'preserves') return p.cook(recipeId)
    wheat(); egg(); p.fruit('apple', 1); p.fruit('pear', 1); p.visit('village')
    return recipeId ? p.act('repeatSignature', recipeId).recipeId as string : p.act('completeSignature',
      { base: 'tart', ingredients: [{ id: 'apple', quantity: 1 }, { id: 'pear', quantity: 1 }] },
      { family: 'decorate', processing: 'bright', fruit: [], steps: ['place'] }).recipeId as string
  }
  function introduce(id: string, base: 'preserves' | 'tart', customer = 'bea') {
    for (let attempt = 0; !p.state.bayShop.memories[customer as 'bea'].purchases[`signature:${id}`]?.liked; attempt++) {
      if (attempt > 12) throw Error('Customer did not like recipe')
      if (p.state.bayShop.visitsToday >= bayShopDailyLimit()) { p.night(); p.visit('village') }
      if (!p.state.culinary.stock[id]) cook(base, id)
      if (p.state.bayShop.slots[0]?.product.id !== `signature:${id}`) {
        if (p.state.bayShop.slots[0]?.quantity) throw Error('Do not discard unsold stock')
        removeBayShopStock(p.state.bayShop, 0); p.reload()
      }
      p.shelf(id); p.sale()
    }
  }
  function finishSingle(id: string, base: 'preserves' | 'tart' = 'preserves') {
    if (p.state.shopCommissions.lastCompletedOn === p.state.day) p.night()
    p.visit('village')
    const offer = C.getShopCommissionOffers(p.state).find(offer => offer.customer === 'bea' && offer.recipeId === id)!
    if (!offer) throw Error('Missing earned order')
    p.act('acceptShopCommission', offer.key)
    for (let n = 0; n < offer.quantity; n++) { cook(base, id); p.act('deliverShopCommission', String(p.state.shopCommissions.serial)) }
    p.act('finishShopCommission', String(p.state.shopCommissions.serial))
  }
  const jam = cook('preserves'); introduce(jam, 'preserves'); finishSingle(jam); finishSingle(jam)
  const tart = cook('tart'); introduce(tart, 'tart')
  if (p.state.shopCommissions.lastCompletedOn === p.state.day) p.night()
  p.visit('village')
  return { p, jam, tart, cook, introduce, finishSingle }
}
