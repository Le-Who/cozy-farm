import { neighborFoodFixture } from './neighbor-food.ts'
import { beginFestival, restoreFarm, treeDefinitions } from '../../src/farm.ts'

export function festivalHarvestFixture() {
  const { farm } = neighborFoodFixture()
  farm.beds = farm.beds.map(() => ({ kind:'crop', crop:'pumpkin', growth:0, watered:true }))
  farm.trees.home = farm.trees.home.map(() => null)
  farm.trees.grove = farm.trees.grove.map(() => null)
  farm.trees.grove[1] = { tree:'pear', age:treeDefinitions.pear.days, fruitReady:2 }
  if (!beginFestival(farm,'harvest').ok) throw Error('Не выбрана программа')
  farm.discoveryPreferences.quiet=true;farm.orientation={collections:true,islands:true}
  if (!restoreFarm(farm)) throw Error('Некорректная проверочная ферма')
  return farm
}
