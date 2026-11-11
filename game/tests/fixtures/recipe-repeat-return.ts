import { neighborFoodFixture } from './neighbor-food.ts'
import { restoreFarm } from '../../src/farm.ts'

export function recipeRepeatReturnFixture(mode: 'missing' | 'away' | 'ready' = 'missing') {
  const { farm, recipeId } = neighborFoodFixture()
  farm.island = mode === 'away' ? 'grove' : 'home'
  farm.produce.wheat = 3
  farm.fruit.apple = 6
  farm.eggs = mode === 'missing' ? 0 : 3
  farm.eggsReady = 0
  farm.eggTrait = null
  farm.eggBaskets = 1
  farm.culinary.recipes.find(recipe => recipe.id === recipeId)!.favorite = true
  if (!restoreFarm(farm)) throw Error('Некорректная проверочная ферма')
  return { farm, recipeId }
}
