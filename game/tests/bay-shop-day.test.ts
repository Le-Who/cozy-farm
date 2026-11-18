import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import * as model from '../src/bay-shop-model.ts'
import { BayShopCustomerView } from '../src/bay-shop-customers.ts'
import { shopReturnLabel, shopRemainderQuote } from '../src/bay-shop-price-copy.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'
import { reserveShopGoods } from '../src/harbour-economy.ts'
import { describeFood } from '../src/intent-orders.ts'
import { closeShopBeforeRest } from '../src/shop-rest.ts'
import { bayShopDayGuidance } from '../src/bay-shop-day.ts'
import { advanceBayShop, setBayShopOpen, stockBayShop } from '../src/bay-shop-model.ts'
import { endDay, foodDescriptors, restoreFarm } from '../src/farm.ts'
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

test('a sold-out shop closed before rest asks for stock, not reopening, on the new day', () => {
  const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))
  const p = commissionPlayer(opening), food = foodDescriptors(p.state).find(item => item.id === 'dish:orchardTart')!
  assert.equal(food.count, 1)
  assert.ok(reserveShopGoods(p.state, food.id, 1))
  assert.ok(stockBayShop(p.state.bayShop, 0, { id: food.id, identity: food.id, name: food.name,
    image: '/art/lavender/ui-tart.webp', basePrice: food.sellPrice, tags: [...food.ingredients, ...describeFood(food)] }, 1))
  const guidance = () => bayShopDayGuidance(p.state.bayShop, Number(p.state.concertDay === p.state.day), true)
  assert.match(guidance().detail, /Откройте/)
  setBayShopOpen(p.state.bayShop, true)
  finishVisitors(p.state, 6)
  assert.equal(p.state.bayShop.sold, 1); assert.equal(p.state.bayShop.slots[0]?.quantity, 0)
  p.visit('home'); assert.ok(closeShopBeforeRest(p.state, String(p.state.day)).ok)
  assert.equal(guidance().action, 'music', 'today’s allowance still takes priority')
  p.night(); p.visit('village')
  assert.equal(p.state.bayShop.open, false); assert.equal(guidance().remaining, 6)
  const before = structuredClone(p.state)
  assert.equal(guidance().detail, 'Сначала выставьте товар на прилавок.')
  assert.deepEqual(p.state, before)
})


test('opening requires stock on a shelf even with goods in hand and in storage; an empty open shop can close', () => {
  const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))
  const p = commissionPlayer(opening), id = p.cook()
  p.shelf(id); p.sale()
  p.cook(id); p.act('transferBayGoods', 'deposit', 'village', 'signature:' + id, 1); p.cook(id)
  const farm = p.state, soldOut = farm.bayShop.slots.find(slot => slot?.quantity === 0)!
  assert.ok(soldOut); assert.equal(farm.culinary.stock[id], 1)
  assert.equal(farm.freight.warehouses.village['signature:' + id], 1)

  const source = readFileSync(new URL('../src/bay-shop.ts', import.meta.url), 'utf8')
  const scene = stripTypeScriptTypes(source.slice(source.indexOf('const escape =')).replace('export function mountBayShop', 'function mountBayShop'))
  const host = { innerHTML: '', querySelector: () => null, contains: () => false, addEventListener() {}, removeEventListener() {} }
  const options = { state: farm.bayShop, products: () => [], onChange() {}, onClose() {} }
  const mounted = runInNewContext(scene + ';mountBayShop(host, options)', {
    ...model, BayShopCustomerView, bayShopDayGuidance, shopReturnLabel, shopRemainderQuote, host, options,
    document: { activeElement: null }, HTMLElement: class {}, HTMLInputElement: class {}, matchMedia: () => ({ matches: true }),
    performance: { now: () => 0 }, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, clearTimeout() {},
    ResizeObserver: class { observe() {} disconnect() {} }, applyIngredientFinishes() {},
  })
  const toggle = () => host.innerHTML.match(/<button[^>]* data-open [^>]*>/)![0]
  assert.match(toggle(), / disabled/); assert.match(toggle(), /aria-pressed="false"/)
  assert.ok(reserveShopGoods(farm, 'signature:' + id, 1)); assert.ok(stockBayShop(farm.bayShop, 0, soldOut.product, 1))
  mounted.refresh(); assert.doesNotMatch(toggle(), /disabled/); assert.match(toggle(), /aria-pressed="false"/)
  setBayShopOpen(farm.bayShop, true); model.removeBayShopStock(farm.bayShop, 0)
  mounted.refresh(); assert.doesNotMatch(toggle(), /disabled/); assert.match(toggle(), /aria-pressed="true"/)
  setBayShopOpen(farm.bayShop, false); mounted.refresh()
  assert.match(toggle(), / disabled/); mounted.destroy()
})
