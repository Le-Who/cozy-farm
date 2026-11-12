import test from 'node:test'
import assert from 'node:assert/strict'
import { createFarm, restoreCurrentFarm, workBed, type CropId } from '../src/farm.ts'
import { saveGardenPlan, followGardenPlan } from '../src/garden-plans.ts'
import { gardenSeedQuote, buyGardenSeeds } from '../src/garden-seed-basket.ts'

const setup = () => {
  const farm = createFarm()
  farm.coins = 100
  farm.beds = Array.from({ length: 16 }, () => ({ kind: 'tilled' as const }))
  farm.seeds.wheat = 1; farm.seeds.carrot = 0
  const crops: (CropId | null)[] = Array(16).fill(null)
  crops.fill('wheat', 0, 5); crops.fill('carrot', 5, 7)
  assert.ok(saveGardenPlan(farm, 0, { name: 'На пироги и суп', crops }, 0).ok)
  assert.ok(followGardenPlan(farm, 0, 1).ok)
  return farm
}

test('garden basket quotes exact ordinary packs, buys once and leaves all farm work manual', () => {
  const farm = setup(), before = structuredClone(farm)
  const quote = gardenSeedQuote(farm, 0, 'open')!
  assert.equal(quote.packs, 3); assert.equal(quote.total, 12); assert.equal(quote.seeds, 9)
  assert.deepEqual(farm, before)
  assert.ok(buyGardenSeeds(farm, quote.token).ok)
  assert.equal(farm.coins, 88); assert.equal(farm.seeds.wheat, 7); assert.equal(farm.seeds.carrot, 3)
  assert.deepEqual(farm.beds, before.beds); assert.equal(farm.gardenPlans.active, 0)
  assert.equal(farm.workToday, before.workToday); assert.equal(farm.day, before.day)
  const bought = structuredClone(farm)
  assert.equal(buyGardenSeeds(farm, quote.token).ok, false); assert.deepEqual(farm, bought)
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))), farm)
  assert.ok(workBed(farm, 0, 0).ok); assert.equal(farm.seeds.wheat, 6)
})
