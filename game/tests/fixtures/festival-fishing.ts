import { neighborFoodFixture } from './neighbor-food.ts'
import { beginFestival, catchFish, getFishLimit, restoreFarm, sail } from '../../src/farm.ts'

export function festivalFishingFixture(exhausted: 'grove' | 'home' | 'both' = 'grove') {
  const { farm } = neighborFoodFixture()
  for (const coast of ['home', 'grove'] as const) {
    if (exhausted !== coast && exhausted !== 'both') continue
    if (!sail(farm, coast).ok) throw Error('Недоступен проверочный берег')
    for (let i = 0; i < getFishLimit(farm); i++) if (!catchFish(farm, true).ok) throw Error('Не заполнена квота')
  }
  if (!sail(farm, 'village').ok || !beginFestival(farm, 'lights').ok || !restoreFarm(farm)) throw Error('Некорректная подготовка праздника')
  farm.discoveryPreferences.quiet = true
  farm.orientation = { collections: true, islands: true }
  return farm
}
