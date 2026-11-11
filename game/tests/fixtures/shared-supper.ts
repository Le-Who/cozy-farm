import { neighborFoodFixture } from './neighbor-food.ts'
import { restoreFarm, workshopShapes } from '../../src/farm.ts'

export function sharedSupperFixture(mode: 'ready'|'missing-fish'|'finn'|'spent'|'home'|'manual' = 'ready') {
  const {farm, recipeId}=neighborFoodFixture()
  farm.village.meals=1; farm.village.mealOn=1; farm.village.residents=['bea',null]
  farm.culinary.stock[recipeId]=2; farm.fish.perch=2; farm.fish.seaBass=2
  if(mode==='missing-fish')farm.fish.perch=0
  if(mode==='finn')farm.village.residents=['finn',null]
  if(mode==='spent')farm.culinary.stock[recipeId]=0
  if(mode==='home')farm.island='home'
  for(const shape of workshopShapes)farm.handmade[shape]=0
  if(mode==='manual'){farm.handmade.round=1;if(!farm.workshopPatterns.includes('round'))farm.workshopPatterns.push('round')}
  if(!restoreFarm(farm))throw Error('Некорректная проверочная ферма')
  return farm
}
