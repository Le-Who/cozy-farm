import { neighborFoodFixture } from './neighbor-food.ts'
import { advanceNeighborPlan, finishNeighborPlan, getIntentOffers, getNeighborPlans, joinNeighborPlan, repeatSignature, restoreFarm, serveNeighborPlan } from '../../src/farm.ts'

export function neighborHelpFixture() {
  const { farm, recipeId } = neighborFoodFixture()
  farm.workshopPatterns = ['round']; farm.handmade.round = 3
  if (!repeatSignature(farm, recipeId).ok) throw Error('Нет угощения Беа')
  for (const resident of ['bea', 'finn'] as const) {
    const plan = getNeighborPlans(farm).find(plan => plan.resident === resident)!
    if (plan.phase === 'preparing') {
      if (!joinNeighborPlan(farm, plan.id).ok) throw Error('Не начата встреча')
      const food = getIntentOffers(farm, plan.intentId).find(offer => offer.available)!
      if (!food || !serveNeighborPlan(farm, plan.id, food.id).ok) throw Error('Нет угощения')
    }
    if (!finishNeighborPlan(farm, plan.id, {kind:plan.arrangement,settled:true,placements:[{slot:'food',x:0,y:0},{slot:'cup',x:.4,y:.2},{slot:'flowers',x:-.4,y:.2}]}).ok || !advanceNeighborPlan(farm, plan.id).ok) throw Error('Не закончена встреча')
  }
  if (!restoreFarm(farm)) throw Error('Некорректная ферма встреч')
  return farm
}
