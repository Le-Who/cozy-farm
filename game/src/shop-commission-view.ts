import type { FarmState } from './farm.ts'
import type { BayShopVisitorId } from './bay-shop-model.ts'
import { getShopCommissionOffers } from './shop-commissions.ts'

/** Local preview only. Domain acceptance still checks the complete live offer key. */
export class ShopCommissionView {
  customer?:BayShopVisitorId
  recipe=''
  mode:'single'|'set'='single'
  current(farm:FarmState) {
    const offers=getShopCommissionOffers(farm)
    const customer=offers.find(offer=>offer.customer===this.customer)?.customer??offers[0]?.customer
    const choices=offers.filter(offer=>offer.customer===customer)
    return {offers,customer,choices,offer:choices.find(offer=>offer.recipeId===this.recipe)??choices[0]}
  }
  choose(farm:FarmState,part:string|undefined,value:string):boolean {
    const current=this.current(farm)
    if(!current.offer)return false
    if(part==='request'){
      if(value==='set')return this.choose(farm,'mode','set')
      if(!this.choose(farm,'recipe',value))return false
      this.mode='single';return true
    }
    if(part==='customer'){
      const next=current.offers.find(offer=>offer.customer===value)
      if(!next)return false
      this.customer=next.customer;this.recipe='';this.mode='single';return true
    }
    if(part==='recipe'){
      const next=current.choices.find(offer=>offer.recipeId===value)
      if(!next)return false
      this.customer=next.customer;this.recipe=next.recipeId;return true
    }
    if(part==='mode'&&(value==='single'||value==='set'&&current.offer.completed>=2)){
      this.mode=value;return true
    }
    return false
  }
}
