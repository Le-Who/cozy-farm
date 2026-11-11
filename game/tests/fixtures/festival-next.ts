import { festivalContributionsFixture } from './festival-contributions.ts'
import { contributeFestival, getFestivalStatus, restoreFarm } from '../../src/farm.ts'

export function festivalNextFixture() {
  const { farm } = festivalContributionsFixture('last')
  if (!contributeFestival(farm, 'fruit', 'apple').ok || !getFestivalStatus(farm).active?.waitingNight || !restoreFarm(farm)) throw Error('Не подготовлено ожидание праздника')
  farm.discoveryPreferences.quiet = true
  farm.orientation = { collections: true, islands: true }
  return farm
}
