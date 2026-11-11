import { neighborFoodFixture } from './neighbor-food.ts'
import { beginFestival, getFestivalStatus, restoreFarm } from '../../src/farm.ts'

/** Synthetic valid third-edition program selected after today's previous concert. */
export function festivalConcertFixture() {
  const { farm } = neighborFoodFixture()
  farm.day = 20
  farm.festivals.completed.stage = 2
  farm.festivals.lastCompletedOn = 18
  farm.musicGarden.festivalUnlocked = true
  farm.musicGarden.festivalLevel = 2
  farm.musicGarden.performances = 2
  farm.concertDay = farm.day
  farm.musicGarden.tempo = 132
  if (!beginFestival(farm, 'stage').ok || getFestivalStatus(farm).active?.requirements[0].available !== 0) throw Error('Не подготовлен новый концерт')
  farm.discoveryPreferences.quiet = true
  farm.orientation = { ...farm.orientation, islands:true, collections:true }
  if (!restoreFarm(farm)) throw Error('Некорректная проверочная ферма')
  return farm
}
