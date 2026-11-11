import test from 'node:test'
import assert from 'node:assert/strict'
import { finishNeighborPlan, getNeighborPlans, restoreFarm, type NeighborAssembly } from '../src/farm.ts'
import { neighborTastingsFixture } from './fixtures/neighbor-tastings.ts'

test('the visible arrangement fixture reloads before and after one exact meeting completion', () => {
  const { farm, recipeId } = neighborTastingsFixture()
  const loaded = restoreFarm(JSON.parse(JSON.stringify(farm)))
  assert.ok(loaded)
  assert.equal(loaded.day, 5)
  assert.equal(loaded.island, 'village')
  assert.equal(loaded.coins, 18)
  assert.equal(loaded.culinary.stock[recipeId], 3)
  assert.equal(loaded.neighbors.bea.current?.phase, 'arranging')
  assert.equal(loaded.neighbors.bea.current?.food?.id, `signature:${recipeId}`)
  const plan = getNeighborPlans(loaded).find(plan => plan.resident === 'bea')!
  const assembly: NeighborAssembly = { kind: 'table', settled: true, placements: [
    { slot: 'food', x: -.4, y: .2 }, { slot: 'cup', x: .4, y: .2 }, { slot: 'flowers', x: 0, y: -.3 },
  ] }
  assert.ok(finishNeighborPlan(loaded, plan.id, assembly).ok)
  assert.equal(loaded.culinary.stock[recipeId], 2)
  assert.equal(loaded.coins, 57)
  assert.equal(loaded.eggs, 96)
  assert.equal(loaded.eggBaskets, 0)
  assert.equal(loaded.neighbors.bea.current?.phase, 'celebrating')
  assert.equal(loaded.neighbors.bea.completed, 1)
  assert.equal(loaded.neighbors.bea.helpReady, true)
  assert.equal(loaded.village.mealOn, 5)
  assert.equal(loaded.village.meals, 3)
  const completed = structuredClone(loaded)
  assert.equal(finishNeighborPlan(loaded, plan.id, assembly).ok, false)
  assert.deepEqual(loaded, completed)
  assert.deepEqual(restoreFarm(JSON.parse(JSON.stringify(loaded))), loaded)
})
