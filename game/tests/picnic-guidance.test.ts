import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createFarm, restoreFarm, completeSignature, useSignature, repeatSignature, cookDish, endDay, beginFishingTrip, cancelFishingTrip, workBed, collectEggs } from '../src/farm.ts'
import { type CookeryResult, type SignatureProcessing, signatureProcessingIds } from '../src/culinary.ts'
import { createFishingPractice } from '../src/fishing-practice.ts'
import { picnicLimitNote, renderPicnicOffer, renderPicnicStatus } from '../src/picnic-guidance.ts'

function recipeFarm(processing: SignatureProcessing) {
  const farm = createFarm()
  farm.day = 5
  farm.buildingLevels.farmhouse = 2
  farm.fruit.apple = 20
  farm.discoveryPreferences.quiet = true
  const result: CookeryResult = { family: 'preserves', processing, fruit: [{ ingredientId: 'apple', x: 0, y: 0, angle: 0 }], steps: ['fruit', 'stir', 'jar'] }
  const id = completeSignature(farm, { base: 'preserves', ingredients: [{ id: 'apple', quantity: 2 }] }, result).recipeId!
  assert.ok(id)
  return { farm, id }
}
const reload = (farm: ReturnType<typeof createFarm>) => restoreFarm(JSON.parse(JSON.stringify(farm)))!

test('all offers visibly describe the cost, real target, consumption time and expiry without mutation', () => {
  const uses = [/обычный заброс/, /блюда на кухне или своего рецепта/, /сбор с грядки/]
  for (const [index, processing] of signatureProcessingIds.entries()) {
    const { farm } = recipeFarm(processing), before = structuredClone(farm)
    const copy = renderPicnicOffer(farm, processing)
    assert.match(copy, /расход 1 порция/)
    assert.match(copy, uses[index])
    assert.match(copy, /только сегодня и исчезнет после сна/)
    assert.equal(renderPicnicStatus(farm), '')
    assert.deepEqual(farm, before)
  }
})

test('one portion creates the active status; repeated use cannot spend another and reload keeps it', () => {
  for (const processing of signatureProcessingIds) {
    const { farm, id } = recipeFarm(processing)
    assert.ok(repeatSignature(farm, id).ok)
    const before = structuredClone(farm), used = useSignature(farm, id)
    assert.ok(used.ok)
    assert.match(used.message, /исчезнет после сна/)
    assert.equal(farm.culinary.stock[id], before.culinary.stock[id] - 1)
    assert.equal(farm.coins, before.coins)
    assert.equal(farm.workToday, before.workToday)
    assert.deepEqual(farm.progress, before.progress)
    const active = structuredClone(farm)
    assert.equal(useSignature(farm, id).ok, false)
    assert.deepEqual(farm, active)
    const restored = reload(farm)
    for (let i = 0; i < 3; i++) {
      assert.match(renderPicnicStatus(restored), /Пикник ещё действует/)
      assert.match(renderPicnicStatus(restored, true), /Перед отдыхом/)
    }
    assert.deepEqual(restored, active)
  }
})

test('viewing the home warning is inert and only explicit rest removes the existing effect', () => {
  for (const processing of signatureProcessingIds) {
    const { farm, id } = recipeFarm(processing)
    useSignature(farm, id)
    farm.beds = farm.beds.map(() => ({ kind: 'empty' }))
    farm.fishCaughtToday = { home: 3, grove: 3 }
    const before = structuredClone(farm)
    assert.match(renderPicnicStatus(farm, true), /Можно отдохнуть сейчас, если бонус не нужен/)
    assert.deepEqual(farm, before)
    assert.ok(endDay(farm).ok)
    assert.equal(farm.day, before.day + 1)
    assert.equal(farm.culinary.picnic, null)
    assert.equal(farm.culinary.stock[id], before.culinary.stock[id])
    assert.equal(farm.coins, before.coins)
    assert.deepEqual(farm.progress, before.progress)
    assert.equal(farm.discoveryPreferences.quiet, true)
    assert.equal(renderPicnicStatus(reload(farm), true), '')
  }
})

test('fishing wording follows the real start/cancel boundary and practice never spends the effect', () => {
  const { farm, id } = recipeFarm('bright')
  useSignature(farm, id)
  const copy = renderPicnicOffer(farm, 'bright')
  assert.match(copy, /при начале рыбалки, даже если уйти без улова/)
  assert.match(copy, /Тренировка не расходует эффект/)
  farm.fishCaughtToday = { home: 3, grove: 3 }
  const before = structuredClone(farm)
  assert.equal(beginFishingTrip(farm).ok, false)
  const practice = createFishingPractice(farm)!
  assert.ok(practice.cast())
  practice.finish(3)
  practice.cancel()
  assert.deepEqual(farm, before)
  assert.match(renderPicnicStatus(reload(farm)), /не продлевает лимит/)
  farm.fishCaughtToday.home = 0
  const trip = beginFishingTrip(farm)
  assert.ok(trip.ok)
  assert.equal(trip.config?.capacity, 3)
  assert.equal(farm.culinary.picnic, null)
  cancelFishingTrip(farm, trip.token!)
  assert.equal(renderPicnicStatus(reload(farm)), '')
  assert.equal(farm.fish.perch, before.fish.perch)
})

test('cooking bonus remains one portion per party and failed cooking does not consume it', () => {
  const { farm, id } = recipeFarm('silky')
  useSignature(farm, id)
  const before = structuredClone(farm)
  assert.equal(cookDish(farm, 'orchardTart').ok, false)
  assert.deepEqual(farm, before)
  assert.ok(repeatSignature(farm, id, undefined, 3).ok)
  assert.equal(farm.culinary.stock[id] - before.culinary.stock[id], 4)
  assert.equal(renderPicnicStatus(reload(farm)), '')
  assert.match(renderPicnicOffer(farm, 'silky'), /Ручная выпечка в мастерской этот эффект не расходует/)
})

test('harvest wording distinguishes beds from eggs and status vanishes after the actual harvest', () => {
  const { farm, id } = recipeFarm('chunky')
  useSignature(farm, id)
  farm.eggsReady = 1
  assert.ok(collectEggs(farm).ok)
  assert.match(renderPicnicStatus(reload(farm)), /Пикник ещё действует/)
  farm.beds[0] = { kind: 'crop', crop: 'carrot', growth: 1, watered: false }
  const before = farm.produce.carrot
  assert.ok(workBed(farm, 0).ok)
  assert.equal(farm.produce.carrot - before, 4)
  assert.equal(renderPicnicStatus(reload(farm)), '')
})

test('quota note uses reachable islands and current limits, without blocking picnic choice', () => {
  const { farm } = recipeFarm('bright')
  farm.fishCaughtToday.home = 3
  assert.match(picnicLimitNote(farm, 'bright'), /оставить порцию/)
  farm.boatOwned = true
  assert.equal(picnicLimitNote(farm, 'bright'), '')
  farm.fishCaughtToday.grove = 3
  assert.notEqual(picnicLimitNote(farm, 'bright'), '')
  farm.projects.dock = { 'dishes:appleJam': 1, 'fruit:pear': 2, seaSalt: 2 }
  assert.equal(picnicLimitNote(farm, 'bright'), '', 'upgraded grove allows a fourth fish')
  farm.fishCaughtToday.grove = 4
  assert.notEqual(picnicLimitNote(farm, 'bright'), '')
  assert.equal(picnicLimitNote(farm, 'chunky'), '')
  assert.equal(picnicLimitNote(farm, 'silky'), '')
})

test('book and home are wired to pure visible guidance, with no new action or expiry policy', () => {
  const book = readFileSync(new URL('../src/culinary-ui.ts', import.meta.url), 'utf8')
  const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
  assert.match(book, /renderPicnicStatus\(farm\)/)
  assert.match(book, /renderPicnicOffer\(farm,recipe.processing\)/)
  assert.match(book, /Устроить пикник · 1 порция/)
  assert.match(main, /case 'rest':[\s\S]*?renderPicnicStatus\(farm,true\)/)
})
