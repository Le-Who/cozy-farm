import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getApiaryCopy, getApiaryPreview } from '../src/apiary-preview.ts'
import { collectCapeHoney, endDay, plantCapeFlower, restoreFarm, sail, upgradeCape } from '../src/farm.ts'
import { apiaryReturnFixture } from './fixtures/apiary-return.ts'

const stock = (farm: ReturnType<typeof apiaryReturnFixture>) => [farm.honey, farm.windHoney, farm.beeswax]

test('collected apiary shows tomorrow’s wind replacement, not today’s regular honey', () => {
  const copy = getApiaryCopy(apiaryReturnFixture())
  assert.equal(copy.heading, 'Завтра · день 8')
  assert.equal(copy.harvest?.honey, 3)
  assert.equal(copy.harvest?.windHoney, 1)
  assert.equal(copy.harvest?.wax, 1)
  assert.match(copy.summary, /уже собран/)
  assert.match(copy.note, /нынешним клумбам и уровню/)
})

test('day after honey wind returns to four regular portions rather than promising another rare one', () => {
  const copy = getApiaryCopy(apiaryReturnFixture('wind'))
  assert.equal(copy.heading, 'Завтра · день 9')
  assert.equal(copy.harvest?.honey, 4)
  assert.equal(copy.harvest?.windHoney, 0)
})

test('empty flowerbeds do not promise honey or flower growth after sleep', () => {
  const copy = getApiaryCopy(apiaryReturnFixture('empty'))
  assert.equal(copy.planted, 0)
  assert.equal(copy.harvest, null)
  assert.equal(copy.heading, '')
  assert.match(copy.summary, /Сначала посадите/)
  assert.equal(copy.tomorrow.honey + copy.tomorrow.windHoney + copy.tomorrow.wax, 0)
})

test('freshly planted beds forecast their first bloom but cannot be harvested early', () => {
  const farm = apiaryReturnFixture('growing'), before = structuredClone(farm)
  const copy = getApiaryCopy(farm)
  assert.equal(copy.now.available, false)
  assert.equal(copy.heading, 'Завтра · день 2')
  assert.equal(copy.harvest?.honey, 3)
  assert.equal(copy.harvest?.wax, 0)
  assert.match(copy.summary, /Цветы посажены/)
  assert.equal(collectCapeHoney(farm).ok, false)
  assert.deepEqual(farm, before)
})

test('ready honey remains today’s harvest, including a new flowerbed that blooms only tomorrow', () => {
  const farm = apiaryReturnFixture('empty')
  plantCapeFlower(farm, 0); sail(farm, 'home'); endDay(farm); sail(farm, 'cape'); plantCapeFlower(farm, 1)
  const copy = getApiaryCopy(farm)
  assert.equal(copy.heading, 'Сегодня · день 2')
  assert.equal(copy.now.available, true)
  assert.equal(copy.harvest?.honey, 1)
  assert.equal(copy.tomorrow.honey, 2)
})

test('preview is pure and survives repeated opening, travel and save reload without advancing or spending', () => {
  const farm = apiaryReturnFixture(), before = structuredClone(farm), preview = getApiaryPreview(farm)
  for (let i = 0; i < 5; i++) getApiaryCopy(farm)
  assert.deepEqual(farm, before)
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)))!
  assert.ok(restored)
  assert.deepEqual(getApiaryPreview(restored), preview)
  sail(restored, 'home')
  assert.equal(restored.day, before.day)
  assert.deepEqual(stock(restored), stock(before))
  assert.equal(restored.coins, before.coins)
  assert.equal(getApiaryPreview(restored).tomorrow.honey, 3)
})

test('next-day forecast equals the real stock delta after explicit sleep, return and one collection', () => {
  for (const mode of ['collected', 'wind', 'growing', 'empty'] as const) {
    const farm = apiaryReturnFixture(mode), predicted = getApiaryPreview(farm).tomorrow, before = stock(farm)
    sail(farm, 'home'); endDay(farm); sail(farm, 'cape')
    const restored = restoreFarm(JSON.parse(JSON.stringify(farm)))!
    assert.ok(restored)
    assert.equal(collectCapeHoney(restored).ok, mode !== 'empty')
    assert.deepEqual(stock(restored).map((value, i) => value - before[i]), [predicted.honey, predicted.windHoney, predicted.wax])
    const once = structuredClone(restored)
    assert.equal(collectCapeHoney(restored).ok, false)
    assert.deepEqual(restored, once)
  }
})

test('one young flower on the eve of honey wind forecasts one rare portion, not an extra portion', () => {
  const farm = apiaryReturnFixture('empty')
  farm.day = 7
  plantCapeFlower(farm, 0)
  const forecast = getApiaryPreview(farm).tomorrow
  assert.equal(forecast.honey, 0)
  assert.equal(forecast.windHoney, 1)
  assert.equal(forecast.wax, 0)
  sail(farm, 'home'); endDay(farm); sail(farm, 'cape')
  assert.equal(collectCapeHoney(farm).ok, true)
  assert.deepEqual(stock(farm), [0, 1, 0])
})

test('preview recalculates after an explicit apiary improvement and never makes the improvement itself', () => {
  const farm = apiaryReturnFixture('growing')
  sail(farm, 'home'); endDay(farm); sail(farm, 'cape'); collectCapeHoney(farm)
  const before = structuredClone(farm), first = getApiaryCopy(farm)
  assert.deepEqual(farm, before)
  assert.equal(first.harvest?.honey, 3)
  assert.equal(first.harvest?.wax, 0)
  assert.equal(upgradeCape(farm).ok, true)
  const after = getApiaryCopy(farm)
  assert.equal(after.harvest?.honey, 4)
  assert.equal(after.harvest?.wax, 1)
  assert.equal(farm.coins, before.coins - 48)
  assert.equal(farm.honey, 0)
  sail(farm, 'home'); endDay(farm); sail(farm, 'cape')
  assert.equal(collectCapeHoney(farm).ok, true)
  assert.deepEqual(stock(farm), [4, 0, 1])
})
