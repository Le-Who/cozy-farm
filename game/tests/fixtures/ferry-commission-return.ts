import { readFileSync } from 'node:fs'
import { commissionPlayer } from './commission-player.ts'
import { harbourTradePlayer } from './harbour-trade-player.ts'
import { getShopCommissionOffers } from '../../src/shop-commissions.ts'

/** Reach both activities from a fresh farm using the normal public commands.
 * Saves reload after each action; shelf stock and customer liking are never granted. */
export function orchardCustomerReturn(){
  const opening=JSON.parse(readFileSync(new URL('./home-progress-actions.json',import.meta.url),'utf8'))
  const grower=harbourTradePlayer(opening)
  grower.build();grower.wheat(2);grower.voyage('explore-orchard')
  const p=commissionPlayer(grower.log)
  const id=p.cook();p.shelf(id);p.sale()
  p.act('acceptShopCommission',getShopCommissionOffers(p.state).find(o=>o.recipeId===id)!.key)
  // If a tree yielded a spare pear, cook and set aside a real first portion.
  const serial=String(p.state.shopCommissions.serial)
  if(p.state.fruit.pear){p.cook(id);p.act('deliverShopCommission',serial)}
  p.fruit('apple',2);p.visit('home');p.act('sendFerryExpedition','orchard-pears');p.night()
  return {p,id,serial}
}
