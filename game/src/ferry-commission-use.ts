import { getSignatureAction, ingredientCount, type FarmState } from './farm.ts'
import { bayProductId } from './bay-product-id.ts'
import { getShopCommission } from './shop-commissions.ts'

export type FerryCommissionUse = { key:string; recipeId:string; recipeName:string; customer:string; ready:number }

/** One optional use for today's settled cargo, not a new order or an automatic cook.
 * Compare exact saved ingredients and remaining portions, including ready stock in the harbour. */
export function ferryCommissionUse(farm:FarmState): FerryCommissionUse|undefined {
  const world=farm.freight.expeditions,last=world.last, cargo=last?.settled?.incoming
  if(!farm.boatOwned||world.active||!last||last.explored||last.day!==farm.day||!cargo?.length)return
  const order=getShopCommission(farm)
  if(!order)return
  for(const line of order.lines){
    const needed=line.remaining-line.inBag-line.warehouse
    if(needed<=0)continue
    const recipe=farm.culinary.recipes.find(r=>r.id===line.recipeId)
    if(!recipe||farm.buildingLevels.farmhouse<(recipe.base==='preserves'?2:1))continue
    const {items}=getSignatureAction(farm,recipe)
    if(!items.length)continue
    let ready=needed, without=needed
    for(const item of items){
      const stock=ingredientCount(farm,item)
      // A plain pear never counts as a pear with a particular trait.
      const brought=cargo.find(lot=>lot.id===bayProductId(item))?.quantity??0
      ready=Math.min(ready,Math.floor(stock/item.quantity))
      without=Math.min(without,Math.floor(Math.max(0,stock-brought)/item.quantity))
    }
    if(ready>without)return {key:`${world.serial}:${order.serial}:${recipe.id}`,recipeId:recipe.id,recipeName:recipe.name,
      customer:order.customerName,ready}
  }
}


/** Resolve again at click time; an old sailing, order, or unavailable batch cannot open another recipe. */
export function openFerryCommissionRecipe(farm:FarmState,key:string|undefined,open:(recipeId:string)=>void){
  const current=ferryCommissionUse(farm)
  if(!current||current.key!==key)return false
  open(current.recipeId)
  return true
}
