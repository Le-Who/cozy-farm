import type { FarmState } from './farm.ts'
import { getShopCommissionOffers, getShopAssortment } from './shop-commissions.ts'
import type { BayShopVisitorId } from './bay-shop-model.ts'

/** Preview only. Acceptance rechecks the complete offer against live state. */
export class ShopAssortmentChoice {
  customer?: BayShopVisitorId
  first = ''
  second = ''
  choose(farm: FarmState, customer: string | undefined, part: string | undefined, recipeId: string) {
    if (part !== 'first' && part !== 'second') return false
    const offers = getShopCommissionOffers(farm).filter(offer => offer.customer === customer && offer.completed >= 2)
    const offer = offers.find(offer => offer.recipeId === recipeId)
    if (!offer && recipeId !== '' || !offers.length) return false
    if (this.customer !== customer) { this.first = ''; this.second = '' }
    this.customer = offers[0].customer
    if (part === 'first') {
      this.first = recipeId
      if (!getShopAssortment(farm, customer, this.first, this.second)) this.second = ''
    } else {
      if (recipeId && !getShopAssortment(farm, customer, this.first, recipeId)) return false
      this.second = recipeId
    }
    return true
  }
}
