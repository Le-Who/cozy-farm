import { neighborFoodFixture } from './neighbor-food.ts'
import { createFarm, getProject, restoreFarm, type FarmState } from '../../src/farm.ts'

export function fairReturnFixture(mode: 'first'|'return'|'served'|'new-flowers' = 'return'): FarmState {
  const farm=mode==='first'?createFarm():neighborFoodFixture().farm
  farm.day=mode==='first'?3:7;farm.island='home';farm.boatOwned=true
  farm.buildingLevels={farmhouse:2,coop:2,well:2};farm.orientation={collections:true,islands:true}
  for(const project of ['dock','fair'] as const)for(const {item} of getProject(farm,project).items)farm.projects[project]['item' in item?`${item.kind}:${item.item}`:item.kind]=item.quantity
  if(mode==='first'){farm.honey=1;farm.capeFlowers[0]=1;farm.capeHoneyOn=2}
  farm.produce.wheat=6;farm.fruit.apple=4;farm.dishes.appleJam=1
  if(mode==='served'){farm.guestServedOn=farm.day;farm.fairGuestsServed++}
  if(mode==='new-flowers')farm.capeFlowers[0]=farm.day
  if(!restoreFarm(farm))throw Error('Некорректная проверочная ярмарка')
  return farm
}
