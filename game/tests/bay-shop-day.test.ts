import test from 'node:test'
import assert from 'node:assert/strict'
import { bayShopDayGuidance } from '../src/bay-shop-day.ts'
import { advanceBayShop, setBayShopOpen } from '../src/bay-shop-model.ts'
import { endDay, restoreFarm } from '../src/farm.ts'
import { shopDayFixture } from './fixtures/shop-day.ts'

function finishVisitors(farm: ReturnType<typeof shopDayFixture>, target: number) {
  for (let ticks = 0; ticks < 2000 && !(farm.bayShop.visitsToday === target && !farm.bayShop.visitor); ticks++) {
    for (const sale of advanceBayShop(farm.bayShop, 100, Number(farm.concertDay === farm.day))) farm.coins += sale.price
  }
  assert.equal(farm.bayShop.visitsToday, target); assert.equal(farm.bayShop.visitor, null)
}

test('the sixth guest finishes before music is offered, without changing visitor allowance or stock', () => {
  const farm = shopDayFixture(), shop = farm.bayShop
  assert.equal(bayShopDayGuidance(shop, 0, true).remaining, 1)
  while (shop.visitsToday === 5) advanceBayShop(shop, 100)
  assert.equal(shop.visitor?.phase, 'approaching')
  const choosing = bayShopDayGuidance(shop, 0, true)
  assert.equal(choosing.remaining, 0); assert.equal(choosing.action, undefined); assert.match(choosing.detail, /ещё в лавке/)
  finishVisitors(farm, 6)
  const before = JSON.stringify(farm)
  for (let i = 0; i < 10; i++) {
    const hint = bayShopDayGuidance(shop, 0, true)
    assert.equal(hint.count, 'Гости сегодня: 6 из 6'); assert.equal(hint.action, 'music'); assert.doesNotMatch(hint.detail, /завтра/)
  }
  assert.equal(JSON.stringify(farm), before); assert.equal(farm.coins, 42); assert.equal(shop.slots[0]?.quantity, 6)
  assert.ok(restoreFarm(JSON.parse(before)))
})

test('the existing concert opens exactly two more visits, then suggests rest', () => {
  const farm = shopDayFixture(); finishVisitors(farm, 6); farm.concertDay = farm.day
  const hint = bayShopDayGuidance(farm.bayShop, 1, true)
  assert.equal(hint.remaining, 2); assert.equal(hint.count, 'Гости сегодня: 6 из 8'); assert.equal(hint.action, undefined)
  finishVisitors(farm, 8)
  assert.equal(farm.coins, 50); assert.equal(farm.bayShop.sold, 8); assert.equal(farm.bayShop.slots[0]?.quantity, 4)
  const before = JSON.stringify(farm), done = bayShopDayGuidance(farm.bayShop, 1, true)
  assert.equal(done.action, 'rest'); assert.equal(JSON.stringify(farm), before)
  finishVisitors(farm, 8); assert.equal(farm.coins, 50)
})

test('closing, reopening and reloading a full day do not reset visitors or earnings', () => {
  const farm = shopDayFixture(true), before = JSON.stringify(farm)
  const loaded = restoreFarm(JSON.parse(before))!; assert.ok(loaded)
  for (const open of [false, true]) {
    setBayShopOpen(loaded.bayShop, open)
    assert.equal(bayShopDayGuidance(loaded.bayShop, 1, true).action, 'rest')
    for (let i = 0; i < 100; i++) assert.deepEqual(advanceBayShop(loaded.bayShop, 1000, 1), [])
  }
  assert.equal(loaded.bayShop.visitsToday, 8); assert.equal(loaded.coins, farm.coins); assert.equal(loaded.bayShop.revenue, farm.bayShop.revenue)
  assert.equal(JSON.stringify(farm), before)
})

test('festival visitors are included in the same existing allowance', () => {
  const farm = shopDayFixture(true); farm.bayShop.festivalVisitors = 3
  const hint = bayShopDayGuidance(farm.bayShop, 1, true)
  assert.equal(hint.remaining, 3); assert.equal(hint.count, 'Гости сегодня: 8 из 11'); assert.equal(hint.action, undefined)
  finishVisitors(farm, 11)
  assert.equal(bayShopDayGuidance(farm.bayShop, 1, true).action, 'rest'); assert.ok(restoreFarm(farm))
})

test('only actual rest starts the next allowance; yesterday music and the sold count remain intact', () => {
  const farm = shopDayFixture(true), coins = farm.coins, shelf = farm.bayShop.slots[0]?.quantity
  const before = JSON.stringify(farm)
  assert.equal(endDay(farm).ok, false); assert.equal(JSON.stringify(farm), before)
  farm.island = 'home'; assert.ok(endDay(farm).ok)
  const loaded = restoreFarm(JSON.parse(JSON.stringify(farm)))!; assert.ok(loaded)
  const hint = bayShopDayGuidance(loaded.bayShop, Number(loaded.concertDay === loaded.day), true)
  assert.equal(loaded.day, 6); assert.equal(loaded.concertDay, 5); assert.equal(hint.count, 'Гости сегодня: 0 из 6')
  assert.equal(hint.action, undefined); assert.equal(loaded.coins, coins); assert.equal(loaded.bayShop.slots[0]?.quantity, shelf); assert.equal(loaded.bayShop.sold, 8)
})
