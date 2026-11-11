import assert from 'node:assert/strict'
import test from 'node:test'
import { createFarm, restoreCurrentFarm, propagateBerry, getBerryPropagation, workBed, endDay, refillWater, cropDefinitions, type FarmState, type CropBed } from '../src/farm.ts'
import { traitIds, getClimate } from '../src/climate.ts'
const clone = (value: FarmState) => JSON.parse(JSON.stringify(value)) as FarmState
function garden(crop: 'strawberry' | 'blueberry' | 'raspberry' = 'blueberry') {
  const f = createFarm(); f.day = 16; f.beds[0] = { kind: 'crop', crop, growth: cropDefinitions[crop].days, watered: false, trait: 'dew' }; f.beds[2] = { kind: 'tilled' }; return f
}
function rejectsUnchanged(f: FarmState, source: number, destination: number, expected?: CropBed) {
  const before = clone(f); assert.equal(propagateBerry(f, source, destination, expected).ok, false); assert.deepEqual(f, before)
}
test('division replaces one ripe berry with two separate seedlings, never a free harvest', () => {
  const f = garden(), before = clone(f)
  assert.equal(propagateBerry(f, 0, 2).ok, true)
  assert.deepEqual(f.beds[0], { kind: 'crop', crop: 'blueberry', growth: 0, watered: false, trait: 'dew' })
  assert.deepEqual(f.beds[0], f.beds[2]); assert.notEqual(f.beds[0], f.beds[2])
  assert.deepEqual(f.produce, before.produce); assert.deepEqual(f.variants, before.variants)
  assert.deepEqual(f.seeds, before.seeds); assert.equal(f.coins, before.coins)
  assert.equal(f.workToday, before.workToday + 1); assert.equal(f.progress.plant, before.progress.plant)
  rejectsUnchanged(f, 0, 3)
})
test('each existing berry and all known traits grow and harvest through unchanged v4 fields', () => {
  for (const crop of ['strawberry', 'blueberry', 'raspberry'] as const) for (const trait of traitIds) {
    let f = garden(crop); (f.beds[0] as CropBed).trait = trait
    assert.equal(propagateBerry(f, 0, 2).ok, true)
    for (let night = 0; night < cropDefinitions[crop].days; night++) {
      for (const i of [0, 2]) { const b = f.beds[i] as CropBed; if (!b.watered) { if (!f.water) refillWater(f); assert.equal(workBed(f, i).ok, true) } }
      assert.equal(endDay(f).ok, true); f = restoreCurrentFarm(clone(f))!
      assert.ok(f); for (const i of [0, 2]) assert.equal((f.beds[i] as CropBed).trait, trait)
    }
    assert.equal(workBed(f, 0).ok, true); assert.equal(workBed(f, 2).ok, true)
    assert.equal(f.produce[crop], 4); assert.equal(f.variants[crop]?.[trait], 2)
    assert.ok(restoreCurrentFarm(clone(f)))
  }
})
test('dry seedlings do not grow; division does not consume a picnic or advance a day', () => {
  const f = garden(); f.culinary.picnic = { processing: 'chunky', day: f.day }
  assert.equal(propagateBerry(f, 0, 2).ok, true); assert.equal(f.day, 16)
  assert.deepEqual(f.culinary.picnic, { processing: 'chunky', day: 16 })
  assert.equal(endDay(f).ok, true); assert.equal((f.beds[0] as CropBed).growth, 0); assert.equal((f.beds[2] as CropBed).growth, 0)
})
test('rain waters the new plants but cannot replace their inherited trait', () => {
  const f = garden(); while (getClimate(f.day).weather !== 'rain') f.day++
  assert.equal(propagateBerry(f, 0, 2).ok, true)
  for (const i of [0, 2]) assert.deepEqual(f.beds[i], { kind: 'crop', crop: 'blueberry', growth: 0, watered: true, trait: 'dew' })
})
test('only home, ripe berries and a distinct prepared empty bed are eligible', () => {
  const f = garden()
  for (const index of [-1, .5, NaN, 99]) rejectsUnchanged(f, index, 2)
  for (const index of [-1, .5, NaN, 99, 0, 1, 8]) rejectsUnchanged(f, 0, index)
  f.island = 'grove'; rejectsUnchanged(f, 0, 2); f.island = 'home'
  f.beds[0] = { kind: 'crop', crop: 'wheat', growth: 2, watered: false }; rejectsUnchanged(f, 0, 2)
  f.beds[0] = { kind: 'crop', crop: 'blueberry', growth: 2, watered: true }; rejectsUnchanged(f, 0, 2)
})
test('a changed source and unsafe counters cannot consume or create a planting', () => {
  const f = garden(), expected = { ...f.beds[0] } as CropBed
  ;(f.beds[0] as CropBed).trait = 'star'; rejectsUnchanged(f, 0, 2, expected)
  f.workToday = Number.MAX_SAFE_INTEGER; rejectsUnchanged(f, 0, 2)
})
test('preview is read-only and ordinary plants do not gain an invented inherited rarity', () => {
  const f = garden(); delete (f.beds[0] as CropBed).trait; const before = clone(f)
  const preview = getBerryPropagation(f, 0, 2); assert.equal(preview.available, true); assert.equal(preview.nights, 3)
  assert.equal(preview.harvest?.ordinary, 3); assert.deepEqual(f, before)
  assert.equal(propagateBerry(f, 0, 2).ok, true)
  assert.equal((f.beds[0] as CropBed).trait, undefined); assert.equal((f.beds[2] as CropBed).trait, undefined)
})
