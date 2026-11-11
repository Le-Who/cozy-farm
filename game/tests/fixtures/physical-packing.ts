import { createFarm, restoreFarm } from '../../src/farm.ts'

export function physicalPackingFixture() {
  const farm = createFarm()
  farm.day = 3
  farm.buildingLevels.coop = 3
  farm.coopSpecialization = 'packing'
  farm.eggs = 16
  farm.eggsReady = 0
  farm.chickensFed = true
  farm.beds = farm.beds.map(() => ({ kind: 'empty' }))
  farm.orientation = { collections: true, islands: true }
  farm.progress = { till: 1, plant: 1, water: 1, rest: 1, harvest: 3, sell: 1, feed: 1, collect: 1 }
  if (!restoreFarm(farm)) throw Error('Некорректная ферма упаковки')
  return farm
}
