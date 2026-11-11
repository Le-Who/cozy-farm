import test from 'node:test'
import assert from 'node:assert/strict'
import { beginFishingTrip, cancelFishingTrip, endDay, finishFishingTrip, getFishAction, getFishingTripConfig, restoreFarm, sail } from '../src/farm.ts'
import { fishingReturnFixture } from './fixtures/fishing-return.ts'

const reload = (farm: ReturnType<typeof fishingReturnFixture>) => restoreFarm(JSON.parse(JSON.stringify(farm)))!

test('viewing prepared fishing repeatedly and reloading never consumes its picnic or Finn help', () => {
  const farm = fishingReturnFixture(), before = structuredClone(farm)
  for (let i = 0; i < 4; i++) {
    assert.ok(getFishAction(farm).available)
    assert.deepEqual(getFishingTripConfig(farm), { capacity: 4, depth: 120, resilience: 5, scouted: true, picnic: 'bright', tasting: true })
  }
  assert.deepEqual(farm, before)
  assert.deepEqual(reload(farm), before)
  assert.equal(cancelFishingTrip(farm).ok, false)
  assert.deepEqual(farm, before)
})

test('a real cast consumes each prepared effect exactly once; cancellation grants nothing and reload preserves that boundary', () => {
  const farm = fishingReturnFixture(), before = structuredClone(farm), started = beginFishingTrip(farm)
  assert.ok(started.ok)
  assert.equal(farm.culinary.picnic, null)
  assert.equal(farm.village.scouting, false)
  assert.equal(farm.culinary.tastings.finn.bonus, false)
  assert.equal(started.config?.capacity, 4)
  assert.equal(started.config?.resilience, 5)
  const pending = reload(farm)
  assert.deepEqual(pending, farm)
  assert.ok(cancelFishingTrip(pending, started.token).ok)
  assert.deepEqual(pending.fish, before.fish)
  assert.deepEqual(pending.fishCaughtToday, before.fishCaughtToday)
  assert.equal(pending.coins, before.coins)
  assert.equal(pending.workToday, before.workToday)
  assert.equal(pending.pendingFishingTrip, null)
  assert.deepEqual(getFishingTripConfig(pending), { capacity: 2, depth: 120, resilience: 2, scouted: false })
  assert.deepEqual(reload(pending), pending)
  const cancelled = structuredClone(pending)
  assert.equal(finishFishingTrip(pending, started.token!, 3).ok, false)
  assert.deepEqual(pending, cancelled)
})

test('quota and wrong-shore refusals preserve every unused effect, with no token issued', () => {
  for (const failure of ['quota', 'shore'] as const) {
    const farm = fishingReturnFixture()
    if (failure === 'quota') farm.fishCaughtToday.home = 3
    else assert.ok(sail(farm, 'village').ok)
    const before = structuredClone(farm)
    assert.equal(beginFishingTrip(farm).ok, false)
    assert.deepEqual(farm, before)
    assert.deepEqual(reload(farm), before)
  }
})

test('rest expires only the same-day picnic, leaving the existing prepared route and Finn help for later', () => {
  const farm = fishingReturnFixture()
  assert.ok(endDay(farm).ok)
  const loaded = reload(farm)
  assert.equal(loaded.culinary.picnic, null)
  assert.equal(loaded.village.scouting, true)
  assert.equal(loaded.culinary.tastings.finn.bonus, true)
  assert.deepEqual(getFishingTripConfig(loaded), { capacity: 3, depth: 120, resilience: 5, scouted: true, tasting: true })
})
