import assert from 'node:assert/strict'
import test from 'node:test'
import { createFarm, endDay, restoreFarm } from '../src/farm.ts'
import { sendFerryExpedition, receiveFerryExpedition } from '../src/harbour-economy.ts'
import { renderFerryReturn } from '../src/ferry-return.ts'

const products = [{id:'handmade:round',name:'Круглая булочка'}]
function sailingFarm() {
  const farm = createFarm()
  farm.boatOwned = true; farm.produce.wheat = 8; farm.eggs = 4
  assert.equal(sendFerryExpedition(farm, 'pair:mill-grain+mill-eggs').ok, true)
  return farm
}

test('an outgoing combined voyage remains a precise, read-only reason to return in the journal and home', () => {
  const farm = sailingFarm(), before = structuredClone(farm)
  const html = renderFerryReturn(farm, products)
  assert.match(html, /Вернётся утром дня 2/)
  assert.match(html, /Мельничный посад/)
  assert.match(html, /Круглая булочка ×2/)
  assert.match(html, /10 монет/)
  assert.match(html, /data-action="ferry-return"/)
  assert.doesNotMatch(html, /data-action="(?:sleep|expedition-claim|expedition-send)"/)
  assert.deepEqual(farm, before)
})

test('the promised manifest survives reload, morning and delayed collection without extra payments', () => {
  let farm = sailingFarm()
  const promised = structuredClone(farm.freight.expeditions.active!), coins = farm.coins
  farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!
  assert.equal(endDay(farm).ok, true)
  assert.match(renderFerryReturn(farm, products), /груз ждёт/)
  assert.match(renderFerryReturn(farm, products), /Круглая булочка ×2/)
  assert.equal(farm.coins, coins)
  assert.equal(farm.handmade.round, 0)
  assert.deepEqual(farm.freight.expeditions.active, {...promised,phase:'ready'})
  assert.equal(endDay(farm).ok, true)
  farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!
  const before = structuredClone(farm)
  for (let i = 0; i < 3; i++) assert.match(renderFerryReturn(farm, products), /не пропадёт/)
  assert.deepEqual(farm, before)
  assert.equal(receiveFerryExpedition(farm).ok, true)
  assert.equal(farm.handmade.round, 2)
  assert.equal(farm.coins, coins + 10)
  assert.equal(renderFerryReturn(farm, products), '')
  const received = structuredClone(farm)
  assert.equal(receiveFerryExpedition(farm).ok, false)
  assert.deepEqual(farm, received)
})

test('exploration stays unknown until arrival and opens its port only after explicit receipt', () => {
  const farm = createFarm(); farm.boatOwned = true; farm.produce.wheat = 10
  farm.freight.expeditions.markets.mill.visits = 1
  assert.equal(sendFerryExpedition(farm, 'explore-salt').ok, true)
  const before = structuredClone(farm)
  assert.match(renderFerryReturn(farm, []), /Новый торговый порт/)
  assert.doesNotMatch(renderFerryReturn(farm, []), /Соляной маяк/)
  assert.deepEqual(farm, before)
  endDay(farm)
  assert.match(renderFerryReturn(farm, []), /Соляной маяк/)
  assert.equal(farm.freight.expeditions.discovered.includes('salt'), false)
  assert.equal(receiveFerryExpedition(farm).ok, true)
  assert.equal(farm.freight.expeditions.discovered.includes('salt'), true)
  assert.equal(renderFerryReturn(farm, []), '')
})

test('a paid purchase shows only the frozen incoming cargo, never a second bill or current market quote', () => {
  const farm = createFarm(); farm.boatOwned = true; farm.coins = 100
  assert.equal(sendFerryExpedition(farm, 'mill-buy').ok, true)
  farm.freight.expeditions.markets.mill.stock['handmade:round'] = 0
  const before = structuredClone(farm), html = renderFerryReturn(farm, products)
  assert.equal(farm.coins, 85)
  assert.match(html, /Круглая булочка ×1/)
  assert.doesNotMatch(html, /монет|оплат|не хватает/)
  assert.deepEqual(farm, before)
})

test('no voyage creates no reminder, and product names are escaped as text', () => {
  const farm = createFarm()
  assert.equal(renderFerryReturn(farm, []), '')
  farm.boatOwned = true
  assert.equal(renderFerryReturn(farm, []), '')
  const sailing = sailingFarm()
  assert.match(renderFerryReturn(sailing, [{id:'handmade:round',name:'<img src=x>'}]), /&lt;img src=x&gt;/)
  assert.doesNotMatch(renderFerryReturn(sailing, [{id:'handmade:round',name:'<img src=x>'}]), /<img/)
})

test('a sale-only voyage promises its exact earnings without inventing return goods', () => {
  const farm = createFarm(); farm.boatOwned = true; farm.produce.wheat = 2
  assert.equal(sendFerryExpedition(farm, 'mill-sale').ok, true)
  const html = renderFerryReturn(farm, products)
  assert.match(html, /10 монет/)
  assert.doesNotMatch(html, /Булочка|булочка/)
})
