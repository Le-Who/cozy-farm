import { neighborFoodFixture } from './neighbor-food.ts'
import { beginFestival, getFishLimit, restoreFarm } from '../../src/farm.ts'

export function festivalShoreFixture(exhausted=false) {
  const { farm } = neighborFoodFixture()
  farm.shellDiscoveries=['regular','moon'];farm.shells={regular:3,moon:1};farm.shellsCollectedToday=[0,1,2]
  farm.fishCaughtToday={home:getFishLimit({...farm,island:'home'}),grove:getFishLimit({...farm,island:'grove'})}
  if(exhausted){farm.shoalCollectedToday=['glass'];farm.shoalFinds.glass=1;farm.shoalDiscoveries=['glass']}
  if (!beginFestival(farm,'lights').ok) throw Error('Не выбрана программа')
  farm.discoveryPreferences.quiet=true;farm.orientation={collections:true,islands:true}
  if (!restoreFarm(farm)) throw Error('Некорректная проверочная ферма')
  return farm
}
