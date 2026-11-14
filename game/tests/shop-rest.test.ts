import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { endDay, getShopRestForecast, restoreFarm } from '../src/farm.ts'
import { advanceBayShop, advanceBayShopDay, setBayShopOpen, setBayShopPrice, stockBayShop } from '../src/bay-shop-model.ts'
import { closeShopBeforeRest, renderShopRest } from '../src/shop-rest.ts'
import { isGuardedAction, ActivationKeyGuard, ActionClickGuard } from '../src/action-click-guard.ts'
import { shopRestFixture } from './fixtures/shop-rest.ts'

function visitUntil(farm: ReturnType<typeof shopRestFixture>, predicate: () => boolean) {
  for (let i = 0; i < 3000 && !predicate(); i++) {
    for (const sale of advanceBayShop(farm.bayShop, 100, Number(farm.concertDay === farm.day))) farm.coins += sale.price
  }
  assert.ok(predicate())
}

test('rest forecast equals actual automatic shelf sales and their separate revenue', () => {
  const farm = shopRestFixture(), forecast = getShopRestForecast(farm), coins = farm.coins
  assert.equal(forecast.sold, 6)
  assert.equal(forecast.revenue, 24)
  assert.deepEqual(forecast.shelves, [{name:'Яблоко',quantity:6,sold:6,remaining:0}])
  assert.equal(endDay(farm).ok, true)
  assert.equal(farm.coins - coins, forecast.revenue)
  assert.equal(farm.bayShop.sold, forecast.sold)
  assert.equal(farm.bayShop.slots[0]?.quantity, forecast.shelves[0].remaining)
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))))
})

test('repeated viewing and reload do not spend stock, advance visitors, or earn money', () => {
  const farm = shopRestFixture(), before = structuredClone(farm)
  for (let i = 0; i < 5; i++) renderShopRest(farm)
  assert.deepEqual(farm, before)
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)))!
  assert.ok(restored)
  assert.deepEqual(getShopRestForecast(restored), getShopRestForecast(farm))
  assert.deepEqual(restored, farm)
})

test('forecast uses the same current catalog prices as endDay, not stale shelf product values', () => {
  const farm = shopRestFixture()
  farm.bayShop.slots[0]!.product.basePrice = 999
  setBayShopPrice(farm.bayShop, 0, 100)
  assert.ok(advanceBayShopDay(structuredClone(farm.bayShop), farm.day + 1).length > 0)
  const before = structuredClone(farm), forecast = getShopRestForecast(farm)
  assert.equal(forecast.sold, 0)
  assert.deepEqual(farm, before)
  endDay(farm)
  assert.equal(farm.bayShop.sold, 0)
  assert.equal(farm.bayShop.slots[0]?.quantity, 6)
})

test('pending visitor is included, while an already paid purchase is never charged twice', () => {
  const pending = shopRestFixture()
  visitUntil(pending, () => pending.bayShop.visitor?.phase === 'browsing')
  assert.equal(pending.bayShop.visitsToday, 1)
  assert.equal(getShopRestForecast(pending).sold, 6)
  visitUntil(pending, () => pending.bayShop.visitor?.phase === 'reacting')
  const forecast = getShopRestForecast(pending), coins = pending.coins
  assert.equal(forecast.sold, 5)
  assert.equal(forecast.revenue, 20)
  endDay(pending)
  assert.equal(pending.coins - coins, 20)
  assert.equal(pending.bayShop.sold, 6)
})

test('concert and festival allowances remain shared with daytime visits', () => {
  const farm = shopRestFixture()
  stockBayShop(farm.bayShop, 0, farm.bayShop.slots[0]!.product, 10)
  farm.concertDay = farm.day; farm.bayShop.festivalVisitors = 3
  assert.equal(getShopRestForecast(farm).sold, 11)
  visitUntil(farm, () => farm.bayShop.visitsToday === 11 && !farm.bayShop.visitor)
  const before = structuredClone(farm), forecast = getShopRestForecast(farm)
  assert.equal(forecast.sold, 0)
  assert.equal(forecast.remainingVisitors, 0)
  assert.deepEqual(farm, before)
  endDay(farm)
  assert.equal(farm.coins, before.coins)
  assert.equal(farm.bayShop.slots[0]?.quantity, 5)
})

test('explicit close retains paid sales, quotas, shelf goods and the current day', () => {
  const farm = shopRestFixture()
  visitUntil(farm, () => farm.bayShop.visitor?.phase === 'reacting')
  const before = structuredClone(farm)
  assert.equal(closeShopBeforeRest(farm, String(farm.day)).ok, true)
  assert.deepEqual(farm, {...before,bayShop:{...before.bayShop,open:false}})
  assert.equal(getShopRestForecast(farm).sold, 0)
  const closed = structuredClone(farm)
  assert.equal(closeShopBeforeRest(farm, String(farm.day)).ok, false)
  assert.deepEqual(farm, closed)
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)))!
  assert.ok(restored)
  endDay(restored)
  assert.equal(restored.coins, before.coins)
  assert.equal(restored.bayShop.slots[0]?.quantity, 5)
  assert.equal(restored.bayShop.sold, 1)
})

test('closing before a visitor buys preserves goods and does not reset their consumed visit', () => {
  const farm = shopRestFixture()
  visitUntil(farm, () => farm.bayShop.visitor?.phase === 'browsing')
  assert.equal(closeShopBeforeRest(farm, String(farm.day)).ok, true)
  assert.equal(farm.bayShop.visitsToday, 1)
  assert.equal(farm.bayShop.slots[0]?.quantity, 6)
  assert.equal(farm.bayShop.visitor?.outcome?.kind, 'closed')
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))))
  setBayShopOpen(farm.bayShop, true)
  assert.equal(getShopRestForecast(farm).sold, 5)
})

test('stale or remote close requests are no-ops, and held/repeated gestures cannot reopen the shop or sleep', () => {
  const farm = shopRestFixture(), before = structuredClone(farm)
  assert.equal(closeShopBeforeRest(farm, '4').ok, false)
  assert.deepEqual(farm, before)
  farm.island = 'village'; const remote = structuredClone(farm)
  assert.equal(closeShopBeforeRest(farm, '5').ok, false)
  assert.deepEqual(farm, remote)
  assert.equal(isGuardedAction('rest-close-shop'), true)
  const key = new ActivationKeyGuard()
  assert.equal(key.blocks({key:'Enter',repeat:false},true), false)
  assert.equal(key.blocks({key:'Enter',repeat:true},false), true)
  key.release('Enter')
  assert.equal(key.blocks({key:'Enter',repeat:false},false), false)
  const clicks = new ActionClickGuard()
  clicks.remember({detail:1,timeStamp:100,clientX:100,clientY:100})
  assert.equal(clicks.blocks({detail:2,timeStamp:150,clientX:100,clientY:100}), true)
})

test('the rest screen distinguishes closed, empty, unaffordable and exhausted stock and escapes names', () => {
  const closed = shopRestFixture(false)
  assert.match(renderShopRest(closed), /Лавка закрыта/)
  assert.doesNotMatch(renderShopRest(closed), /data-action="rest-close-shop"/)
  const open = shopRestFixture()
  assert.match(renderShopRest(open), /data-value="5"/)
  assert.match(renderShopRest(open), /Выручка: 24 монеты/)
  setBayShopPrice(open.bayShop, 0, 10000)
  assert.match(renderShopRest(open), /дополнительных покупок не будет/)
  open.bayShop.slots[0]!.product.name = '<img src=x>'
  assert.match(renderShopRest(open), /&lt;img src=x&gt;/)
  open.bayShop.slots[0]!.quantity = 0
  assert.match(renderShopRest(open), /полки пусты/)
})

test('the rest sales quantity, revenue and close action stay outside the optional shelf details', () => {
  const farm=shopRestFixture(),before=structuredClone(farm),html=renderShopRest(farm)
  const details=html.indexOf('<details>')
  for(const text of ['купят товаров с полок: 6','Выручка: 24 монеты','data-action="rest-close-shop" data-value="5"','Закрытие сохранит товары и не переведёт день.']){
    assert.ok(html.indexOf(text)>=0 && html.indexOf(text)<details,text)
  }
  assert.match(html,/Остаток на полках после отдыха/)
  assert.match(html,/Прогноз по нынешним полкам и ценам/)
  assert.match(html,/оставшихся гостей сегодняшнего дня/)
  assert.deepEqual(farm,before)
})

test('leaving the shop screen no longer claims to close the business', () => {
  const source = readFileSync(new URL('../src/bay-shop.ts', import.meta.url), 'utf8')
  assert.match(source, /data-close aria-label="Вернуться в бухту"/)
  assert.doesNotMatch(source, /Закрыть лавку и вернуться/)
})
