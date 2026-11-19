import { readFileSync } from 'node:fs'
import { commissionPlayer } from './commission-player.ts'
import { getShopCommissionOffers } from '../../src/shop-commissions.ts'
import { getBedAction, getBedStage } from '../../src/farm.ts'

/** Two real preserves for the buyer, a different chunky jar for the grower. No
 * gifted ingredients, assumed ripe bed, or auto-harvest. Every normal command reloads. */
export function harvestPicnicPlayer() {
  const opening=JSON.parse(readFileSync(new URL('./home-progress-actions.json',import.meta.url),'utf8'))
  const p=commissionPlayer(opening)
  const orderRecipe=p.cook();p.shelf(orderRecipe);p.sale()
  const offer=getShopCommissionOffers(p.state).find(o=>o.recipeId===orderRecipe)!
  p.act('acceptShopCommission',offer.key)
  const serial=String(p.state.shopCommissions.serial)
  for(let i=0;i<offer.quantity;i++){p.cook(orderRecipe);p.act('deliverShopCommission',serial)}
  p.fruit('apple',2);p.visit('village')
  const picnicRecipe=String(p.act('completeSignature',{base:'preserves',ingredients:[{id:'apple',quantity:2}]},
    {family:'preserves',processing:'chunky',fruit:[],steps:['mix','pour']}).recipeId)
  const paid=p.state.coins;p.act('finishShopCommission',serial)
  if(p.state.coins!==paid+offer.total)throw Error('Ordinary commission was not paid')
  // Collect what is already ripe, leaving a real no-payoff decision with a saved jar.
  p.visit('home')
  for(const [i,bed] of p.state.beds.entries())if(getBedStage(bed)==='ripe')p.act('workBed',i)
  const deferred=structuredClone(p.state)
  // A normal planted crop grows by watering + rest, never by merely eating.
  const field=p.state.beds.findIndex(b=>b.kind==='tilled')
  if(!p.state.seeds.carrot)p.act('buySeeds','carrot')
  if(p.state.selectedSeed!=='carrot')p.act('selectSeed','carrot')
  p.act('workBed',field)
  for(let nights=0;getBedStage(p.state.beds[field])!=='ripe';nights++){
    if(nights>6)throw Error('Field did not mature')
    if(getBedAction(p.state,field).kind==='water'){if(!p.state.water)p.act('refillWater');p.act('workBed',field)}
    p.night()
  }
  return {p,picnicRecipe,orderRecipe,deferred,offer}
}
