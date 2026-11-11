import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFarm, cropIds, cropDefinitions, getBedAction, getBedHarvestPreview, workBed, restoreFarm, pickFruit, collectEggs } from '../src/farm.ts'
import { traitIds, getClimate } from '../src/climate.ts'
import { harvestPreviewCopy } from '../src/harvest-preview.ts'

test('every crop and weather trait preview equals the actual inventory delta, with or without picnic', () => {
  for (const crop of cropIds) for (const trait of [undefined, ...traitIds]) for (const picnic of [false, true]) {
    const farm = createFarm()
    farm.beds[0] = { kind: 'crop', crop, growth: cropDefinitions[crop].days, watered: false, ...(trait ? { trait } : {}) }
    if (picnic) farm.culinary.picnic = { processing: 'chunky', day: farm.day }
    const before = structuredClone(farm)
    const preview = getBedHarvestPreview(farm, 0)!
    assert.equal(preview.total, cropDefinitions[crop].yield + Number(picnic))
    assert.equal(preview.ordinary + preview.special, preview.total)
    assert.equal(preview.special, Number(!!trait))
    assert.equal(preview.picnicBonus, Number(picnic))
    assert.ok(getBedAction(farm, 0).label.endsWith(`× ${preview.total}`))
    assert.deepEqual(farm, before, 'inspection must be pure')
    assert.equal(workBed(farm, 0).ok, true)
    assert.equal(farm.produce[crop] - before.produce[crop], preview.ordinary)
    if (trait) assert.equal((farm.variants[crop]?.[trait] ?? 0) - (before.variants[crop]?.[trait] ?? 0), preview.special)
    assert.equal(getBedHarvestPreview(farm, 0), undefined)
  }
})

test('repeated previews and reload retain the picnic; only the next successful harvest uses it', () => {
  let farm = createFarm()
  for (const index of [0, 1]) farm.beds[index] = { kind: 'crop', crop: 'carrot', growth: 1, watered: false, trait: 'rainbow' }
  farm.culinary.picnic = { processing: 'chunky', day: farm.day }
  const before = structuredClone(farm)
  for (let i = 0; i < 4; i++) {
    assert.equal(getBedHarvestPreview(farm, 0)?.total, 4)
    assert.equal(getBedHarvestPreview(farm, 1)?.total, 4)
  }
  assert.deepEqual(farm, before)
  farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!
  assert.ok(farm)
  assert.deepEqual(getBedHarvestPreview(farm, 0), { crop: 'carrot', total: 4, ordinary: 3, special: 1, trait: 'rainbow', picnicBonus: 1 })
  assert.ok(workBed(farm, 0).ok)
  assert.equal(farm.culinary.picnic, null)
  assert.deepEqual(getBedHarvestPreview(farm, 1), { crop: 'carrot', total: 3, ordinary: 2, special: 1, trait: 'rainbow', picnicBonus: 0 })
  assert.ok(workBed(farm, 1).ok)
  assert.equal(farm.produce.carrot, 5)
  assert.equal(farm.variants.carrot?.rainbow, 2)
})

test('invalid, unripe and off-island targets never advertise or consume a harvest', () => {
  const farm = createFarm()
  farm.culinary.picnic = { processing: 'chunky', day: farm.day }
  farm.beds[0] = { kind: 'crop', crop: 'carrot', growth: 0, watered: true }
  for (const index of [-1, .5, NaN, Infinity, 100, 0]) {
    const before = structuredClone(farm)
    assert.equal(getBedHarvestPreview(farm, index), undefined)
    assert.equal(workBed(farm, index).ok, false)
    assert.deepEqual(farm, before)
  }
  for (const kind of ['empty', 'tilled'] as const) {
    farm.beds[0] = { kind }
    assert.equal(getBedHarvestPreview(farm, 0), undefined)
  }
  farm.beds[0] = { kind: 'crop', crop: 'carrot', growth: 1, watered: false }
  farm.island = 'grove'
  const before = structuredClone(farm)
  assert.equal(getBedHarvestPreview(farm, 0), undefined)
  assert.equal(workBed(farm, 0).ok, false)
  assert.deepEqual(farm, before)
})

test('preview uses the crop stored trait, not today weather or an unrelated picnic', () => {
  const farm = createFarm()
  assert.equal(getClimate(farm.day).weather, 'sun')
  farm.beds[0] = { kind: 'crop', crop: 'pumpkin', growth: 3, watered: false, trait: 'frost' }
  for (const processing of ['silky', 'bright'] as const) {
    farm.culinary.picnic = { processing, day: farm.day }
    const preview = getBedHarvestPreview(farm, 0)!
    assert.equal(preview.special, 1)
    assert.equal(preview.ordinary, cropDefinitions.pumpkin.yield - 1)
    assert.equal(preview.trait, 'frost')
    assert.equal(preview.picnicBonus, 0)
  }
  farm.culinary.picnic = { processing: 'chunky', day: farm.day - 1 }
  assert.equal(getBedHarvestPreview(farm, 0)?.picnicBonus, 0)
  assert.ok(workBed(farm, 0).ok)
  assert.deepEqual(farm.culinary.picnic, { processing: 'chunky', day: farm.day - 1 })
})

test('fruit and egg gathering preserve the bed-only picnic and existing variant split', () => {
  const farm = createFarm()
  farm.culinary.picnic = { processing: 'chunky', day: farm.day }
  farm.trees.home[0] = { tree: 'apple', age: 2, fruitReady: 2, trait: 'dew' }
  assert.ok(pickFruit(farm, 0).ok)
  assert.equal(farm.fruit.apple, 1)
  assert.equal(farm.variants.apple?.dew, 1)
  farm.eggsReady = 2; farm.eggTrait = 'star'
  assert.ok(collectEggs(farm).ok)
  assert.equal(farm.eggs, 1)
  assert.equal(farm.variants.egg?.star, 1)
  assert.deepEqual(farm.culinary.picnic, { processing: 'chunky', day: farm.day })
})

test('ordinary garden work does not spend the next-harvest bonus', () => {
  const farm = createFarm()
  farm.culinary.picnic = { processing: 'chunky', day: farm.day }
  farm.beds[0] = { kind: 'empty' }
  for (let step = 0; step < 3; step++) {
    assert.equal(getBedHarvestPreview(farm, 0), undefined)
    assert.ok(workBed(farm, 0).ok, 'till, plant and water remain ordinary actions')
    assert.deepEqual(farm.culinary.picnic, { processing: 'chunky', day: farm.day })
  }
})

test('compact copy names ordinary and special portions without counting picnic twice', () => {
  const farm = createFarm()
  farm.beds[0] = { kind: 'crop', crop: 'carrot', growth: 1, watered: false, trait: 'rainbow' }
  farm.culinary.picnic = { processing: 'chunky', day: farm.day }
  const copy = harvestPreviewCopy(getBedHarvestPreview(farm, 0)!)
  assert.equal(copy.action, 'Собрать +4')
  assert.equal(copy.detail, 'Обычные ×3 · Радужная ×1')
  assert.equal(copy.bonus, 'Пикник +1 уже учтён')
  assert.match(copy.hint, /Морковь · Собрать \+4 · Обычные ×3 · Радужная ×1 · Пикник \+1 уже учтён/)
  workBed(farm, 0)
  farm.beds[1] = { kind: 'crop', crop: 'pumpkin', growth: 3, watered: false, trait: 'star' }
  const next = harvestPreviewCopy(getBedHarvestPreview(farm, 1)!)
  assert.equal(next.action, 'Собрать +2')
  assert.equal(next.detail, 'Обычные ×1 · Звёздная ×1')
  assert.equal(next.bonus, '')
})
