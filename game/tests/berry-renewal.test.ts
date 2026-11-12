import test from 'node:test'
import assert from 'node:assert/strict'
import { createFarm, cropDefinitions, berryCropIds, getBerryRenewalPreview, harvestBerryAndKeep, restoreCurrentFarm, workBed, endDay, refillWater, getBedStage, getBerryPropagation, type CropBed, type FarmState } from '../src/farm.ts'
import { getClimate, traitIds } from '../src/climate.ts'
import { getRestPreview } from '../src/rest-preview.ts'
import { saveGardenPlan, followGardenPlan } from '../src/garden-plans.ts'
import { gardenSeedQuote } from '../src/garden-seed-basket.ts'
import { inviteNeighborVisit } from '../src/neighbor-visits.ts'
import { neighborHelpFixture } from './fixtures/neighbor-help.ts'

const clone = <T>(value: T): T => structuredClone(value)
function garden(): FarmState {
  const farm = createFarm()
  farm.beds[0] = { kind: 'crop', crop: 'strawberry', growth: 2, watered: true, wateredAt: 123 }
  return farm
}

test('one ripe berry can be picked while keeping its planting, without seeds or hidden work', () => {
  const farm = garden(), before = clone(farm)
  const preview = getBerryRenewalPreview(farm, 0)!
  assert.deepEqual({ ...preview, token: '' }, {
    index: 0, crop: 'strawberry', token: '', total: 1, ordinary: 1, special: 0,
    picnicBonus: 0, nights: 2, retainsWater: false,
  })
  assert.deepEqual(farm, before, 'inspection is read-only')
  assert.ok(harvestBerryAndKeep(farm, preview.token).ok)
  assert.equal(farm.produce.strawberry, before.produce.strawberry + 1)
  assert.deepEqual(farm.beds[0], { kind: 'crop', crop: 'strawberry', growth: 0, watered: false })
  assert.deepEqual(farm.seeds, before.seeds)
  assert.equal(farm.coins, before.coins)
  assert.equal(farm.water, before.water)
  assert.equal(farm.day, before.day)
  assert.equal(farm.workToday, before.workToday + 1)
  assert.equal(farm.progress.harvest, before.progress.harvest + 1)
  assert.deepEqual(farm.gardenPlans, before.gardenPlans)
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))), farm)
})

test('unsafe stock or ordinary harvest counters reject the entire operation without consuming a picnic', () => {
  for (const change of [
    (f: FarmState) => { f.produce.strawberry = Number.MAX_SAFE_INTEGER },
    (f: FarmState) => { f.workToday = Number.MAX_SAFE_INTEGER },
    (f: FarmState) => { f.progress.harvest = Number.MAX_SAFE_INTEGER },
    (f: FarmState) => { f.progress.harvest = 2; f.coins = Number.MAX_SAFE_INTEGER },
    (f: FarmState) => { f.beds[0] = { kind: 'crop', crop: 'strawberry', growth: 2, watered: false, trait: 'star' }; f.variants.strawberry = { star: Number.MAX_SAFE_INTEGER } },
  ]) {
    const farm = garden(); farm.culinary.picnic = { day: farm.day, processing: 'chunky' }; change(farm)
    const token = getBerryRenewalPreview(farm, 0)!.token, before = clone(farm)
    assert.equal(harvestBerryAndKeep(farm, token).ok, false)
    assert.deepEqual(farm, before)
  }
})

test('every berry needs its full ordinary growth cycle again, with dry nights and blueberry water retention intact', () => {
  for (const crop of berryCropIds) {
    let farm = garden()
    farm.beds = Array.from({ length: 16 }, () => ({ kind: 'tilled' as const }))
    farm.beds[0] = { kind: 'crop', crop, growth: cropDefinitions[crop].days, watered: true, wateredAt: 123, trait: 'frost' }
    const token = getBerryRenewalPreview(farm, 0)!.token
    assert.equal(getBerryRenewalPreview(farm, 0)!.nights, crop === 'blueberry' ? 3 : 2)
    assert.equal(getBerryRenewalPreview(farm, 0)!.retainsWater, crop === 'blueberry')
    assert.ok(harvestBerryAndKeep(farm, token).ok)
    assert.equal(getBerryPropagation(farm, 0, 1).available, false)
    assert.deepEqual(getRestPreview(farm).dry, [{ index: 0, crop }])
    assert.ok(endDay(farm).ok)
    assert.equal((farm.beds[0] as CropBed).growth, 0, 'old watering does not fund another growth night')
    const nights = crop === 'blueberry' ? 3 : 2
    for (let night = 0; night < nights; night++) {
      const bed = farm.beds[0] as CropBed
      if (!bed.watered) { if (!farm.water) assert.ok(refillWater(farm).ok); assert.ok(workBed(farm, 0, 100 + night).ok) }
      if (night === nights - 1) assert.deepEqual(getRestPreview(farm).ripening, [{ index: 0, crop }])
      assert.ok(endDay(farm).ok)
      if (night === 0) assert.equal((farm.beds[0] as CropBed).watered, crop === 'blueberry')
      farm = restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!
      assert.ok(farm)
      assert.equal((farm.beds[0] as CropBed).growth, night + 1)
      assert.equal((farm.beds[0] as CropBed).trait, 'frost')
      assert.equal(getBedStage(farm.beds[0]), night === nights - 1 ? 'ripe' : 'growing')
    }
    assert.equal(getBerryPropagation(farm, 0, 1).available, true)
    const before = clone(farm)
    assert.equal(harvestBerryAndKeep(farm, token).ok, false, 'a ripe-looking later cycle cannot reuse the old day token')
    assert.deepEqual(farm, before)
    assert.ok(harvestBerryAndKeep(farm, getBerryRenewalPreview(farm, 0)!.token).ok)
    assert.equal(farm.variants[crop]?.frost, 2)
  }
})

test('current rain alone waters the renewed plants, without transferring old watering timestamps', () => {
  for (const crop of berryCropIds) {
    const farm = garden()
    while (getClimate(farm.day).weather !== 'rain') farm.day++
    farm.beds[0] = { kind: 'crop', crop, growth: cropDefinitions[crop].days, watered: false, trait: 'star' }
    assert.ok(harvestBerryAndKeep(farm, getBerryRenewalPreview(farm, 0)!.token).ok)
    assert.deepEqual(farm.beds[0], { kind: 'crop', crop, growth: 0, watered: true, trait: 'star' })
    assert.equal(farm.water, 6)
    assert.ok(endDay(farm).ok)
    assert.equal((farm.beds[0] as CropBed).growth, 1)
    assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))), farm)
  }
})

test('each inherited trait yields one exact variant; the chunky picnic adds one ordinary berry only once', () => {
  for (const crop of berryCropIds) for (const trait of traitIds) {
    let farm = garden()
    for (const index of [0, 1]) farm.beds[index] = { kind: 'crop', crop, growth: cropDefinitions[crop].days, watered: false, trait }
    farm.culinary.picnic = { day: farm.day, processing: 'chunky' }
    const first = getBerryRenewalPreview(farm, 0)!, staleSecond = getBerryRenewalPreview(farm, 1)!.token
    assert.equal(first.total, 2); assert.equal(first.ordinary, 1); assert.equal(first.special, 1); assert.equal(first.picnicBonus, 1)
    const before = clone(farm)
    for (let read = 0; read < 3; read++) assert.deepEqual(getBerryRenewalPreview(farm, 0), first)
    assert.deepEqual(farm, before)
    farm = restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!
    assert.ok(harvestBerryAndKeep(farm, first.token).ok)
    assert.equal(farm.culinary.picnic, null)
    const once = clone(farm)
    for (const token of [first.token, staleSecond]) { assert.equal(harvestBerryAndKeep(farm, token).ok, false); assert.deepEqual(farm, once) }
    const second = getBerryRenewalPreview(farm, 1)!
    assert.equal(second.total, 1); assert.equal(second.ordinary, 0); assert.equal(second.special, 1); assert.equal(second.picnicBonus, 0)
    assert.ok(harvestBerryAndKeep(farm, second.token).ok)
    assert.equal(farm.produce[crop], before.produce[crop] + 1)
    assert.equal(farm.variants[crop]?.[trait], 2)
    assert.equal(farm.discoveries[crop]?.[trait], true)
    assert.equal((farm.beds[0] as CropBed).trait, trait)
    assert.equal((farm.beds[1] as CropBed).trait, trait)
    assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))), farm)
  }
})

test('changed day, exact planting or picnic invalidates a reviewed harvest without side effects', () => {
  for (const change of [
    (f: FarmState) => { f.day++ },
    (f: FarmState) => { (f.beds[0] as CropBed).crop = 'raspberry' },
    (f: FarmState) => { (f.beds[0] as CropBed).growth++ },
    (f: FarmState) => { (f.beds[0] as CropBed).watered = false },
    (f: FarmState) => { (f.beds[0] as CropBed).wateredAt = 124 },
    (f: FarmState) => { delete (f.beds[0] as CropBed).wateredAt },
    (f: FarmState) => { (f.beds[0] as CropBed).trait = 'rainbow' },
    (f: FarmState) => { f.culinary.picnic = null },
    (f: FarmState) => { f.culinary.picnic = { day: 1, processing: 'bright' } },
    (f: FarmState) => { f.beds[1] = { kind: 'crop', crop: 'wheat', growth: 2, watered: false }; assert.ok(workBed(f, 1).ok) },
  ]) {
    const farm = garden(); farm.culinary.picnic = { day: farm.day, processing: 'chunky' }
    const token = getBerryRenewalPreview(farm, 0)!.token
    change(farm)
    const before = clone(farm)
    assert.equal(harvestBerryAndKeep(farm, token).ok, false)
    assert.deepEqual(farm, before)
  }
})

test('invalid tokens, nonripe or nonberry beds, and other islands cannot renew a crop', () => {
  const farm = garden(), token = getBerryRenewalPreview(farm, 0)!.token
  for (const bad of [undefined, null, {}, 1, '', token + 'x', 'x'.repeat(1001), token.replace(';0;', ';16;'), token.replace(';0;', ';00;')]) {
    const before = clone(farm)
    assert.equal(harvestBerryAndKeep(farm, bad).ok, false); assert.deepEqual(farm, before)
  }
  for (const index of [-1, .5, NaN, Infinity, 16]) assert.equal(getBerryRenewalPreview(farm, index), undefined)
  for (const bed of [
    { kind: 'empty' as const }, { kind: 'tilled' as const },
    { kind: 'crop' as const, crop: 'strawberry' as const, growth: 1, watered: true },
    { kind: 'crop' as const, crop: 'wheat' as const, growth: 2, watered: true },
  ]) {
    farm.beds[0] = bed; const before = clone(farm)
    assert.equal(getBerryRenewalPreview(farm, 0), undefined)
    assert.equal(harvestBerryAndKeep(farm, token).ok, false); assert.deepEqual(farm, before)
  }
  farm.beds[0] = garden().beds[0]
  for (const island of ['grove', 'cape', 'village'] as const) {
    farm.island = island; const before = clone(farm)
    assert.equal(getBerryRenewalPreview(farm, 0), undefined)
    assert.equal(harvestBerryAndKeep(farm, token).ok, false); assert.deepEqual(farm, before)
  }
})

test('other picnics remain untouched and cannot be silently replaced after review', () => {
  for (const picnic of [{ day: 1, processing: 'bright' as const }, { day: 1, processing: 'silky' as const }, { day: 0, processing: 'chunky' as const }]) {
    const farm = garden(); farm.culinary.picnic = picnic
    const preview = getBerryRenewalPreview(farm, 0)!
    assert.equal(preview.total, 1); assert.equal(preview.picnicBonus, 0)
    farm.culinary.picnic = null
    const before = clone(farm)
    assert.equal(harvestBerryAndKeep(farm, preview.token).ok, false); assert.deepEqual(farm, before)
    farm.culinary.picnic = picnic
    assert.ok(harvestBerryAndKeep(farm, preview.token).ok)
    assert.deepEqual(farm.culinary.picnic, picnic)
  }
})

test('ordinary harvest remains full and clears the bed; both paths record one ordinary reward and visit', () => {
  for (const crop of berryCropIds) {
    const farm = neighborHelpFixture(); farm.island = 'home'
    farm.beds[0] = { kind: 'crop', crop, growth: cropDefinitions[crop].days, watered: false, trait: 'star' }
    farm.progress.harvest = 2
    farm.culinary.picnic = { day: farm.day, processing: 'chunky' }
    assert.ok(inviteNeighborVisit(farm, 'beaHarvest').ok)
    assert.ok(saveGardenPlan(farm, 0, { name: 'Ягодник', crops: Array(16).fill(crop) }, 0).ok)
    assert.ok(followGardenPlan(farm, 0, 1).ok)
    const book = clone(farm.gardenPlans), required = gardenSeedQuote(farm, 0, 'open')!.lines[0].required
    assert.ok(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))))
    const ordinary = clone(farm), before = clone(farm)
    assert.ok(workBed(ordinary, 0).ok)
    assert.deepEqual(ordinary.beds[0], { kind: 'tilled' })
    assert.equal(ordinary.produce[crop], before.produce[crop] + 3)
    assert.equal(ordinary.variants[crop]?.star, 1)
    assert.ok(harvestBerryAndKeep(farm, getBerryRenewalPreview(farm, 0)!.token).ok)
    assert.equal(farm.produce[crop], before.produce[crop] + 1)
    assert.equal(farm.variants[crop]?.star, 1)
    assert.equal(farm.coins, before.coins + 8, 'only the existing third-harvest goal reward')
    assert.equal(farm.progress.harvest, 3)
    assert.equal(farm.neighborVisits.memories.length, 1)
    assert.equal(farm.neighborVisits.memories[0].subject, cropDefinitions[crop].name)
    assert.deepEqual(farm.gardenPlans, book)
    assert.equal(gardenSeedQuote(farm, 0, 'open')!.lines[0].required, required)
    assert.equal(gardenSeedQuote(ordinary, 0, 'open')!.lines[0].required, required + 1)
    ordinary.produce[crop] -= 2; ordinary.beds[0] = clone(farm.beds[0])
    assert.deepEqual(farm, ordinary, 'all other ordinary harvest effects must be identical')
    assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))), farm)
  }
})
