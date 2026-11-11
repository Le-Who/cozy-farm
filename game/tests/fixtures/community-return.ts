import { neighborFoodFixture } from './neighbor-food.ts'
import { neighborHelpFixture } from './neighbor-help.ts'
import { endDay, getCommunityOrders, getNeighborPlans, restoreFarm } from '../../src/farm.ts'

export function communityReturnFixture(kind: 'meeting' | 'recipe' | 'intent' | 'blocked' = 'meeting') {
  if (kind === 'recipe') {
    const { farm, recipeId, planId } = neighborFoodFixture(); farm.island='home'
    return { farm, selection: {request:{kind:'neighbor',resident:'bea',planId},food:`signature:${recipeId}`} }
  }
  const farm=neighborHelpFixture(); farm.island='home'
  if (!endDay(farm).ok) throw Error('Нет нового утра')
  if (kind==='intent') {
    farm.island='village'
    const order=getCommunityOrders(farm).find(order=>order.unlocked && !order.delivered)!
    return {farm,selection:{request:{kind:'intent',orderId:order.id}}}
  }
  if (kind==='blocked') farm.boatOwned=false
  const plan=getNeighborPlans(farm).find(plan=>plan.resident==='finn')!
  if (!restoreFarm(farm)) throw Error('Некорректная ферма возвращения')
  return {farm,selection:{request:{kind:'neighbor',resident:'finn',planId:plan.id}}}
}
