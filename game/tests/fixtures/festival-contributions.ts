import { neighborFoodFixture } from './neighbor-food.ts'
import { beginFestival, contributeFestival, repeatSignature, restoreFarm } from '../../src/farm.ts'

export function festivalContributionsFixture(mode: 'start' | 'last' = 'start') {
  const { farm, recipeId } = neighborFoodFixture()
  if (!beginFestival(farm, 'harvest').ok || !repeatSignature(farm, recipeId).ok || !contributeFestival(farm, 'participation', 'bake').ok) throw Error('Не подготовлен праздник')
  farm.fruit.apple = 6
  farm.fruit.pear = 0
  farm.fruit.peach = 0
  if (mode === 'last') for(let i=0;i<2;i++) if(!contributeFestival(farm,'fruit','apple').ok)throw Error('Не внесены плоды')
  if(!restoreFarm(farm))throw Error('Некорректная проверочная ферма')
  return {farm}
}
