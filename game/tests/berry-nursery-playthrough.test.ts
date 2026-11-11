import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { berryNurseryPlayer } from './fixtures/berry-nursery-player.ts'
import { getShopCommissionOffers, getShopCommission } from '../src/shop-commissions.ts'
import { type CropBed } from '../src/farm.ts'
const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8'))

test('an earned weather berry line supplies an authored recipe and repeated orders without injecting resources', () => {
  const n = berryNurseryPlayer(opening), p = n.p
  assert.equal(p.state.day, 17); assert.equal(p.state.coins, 61)
  // Invest the only ripe harvest in two seedlings, then choose further expansion to four beds.
  n.divide(0, 2); n.grow(); n.divide(0, 3); n.divide(2, 4); n.grow()
  assert.equal(p.state.day, 23)
  for (const i of [0, 2, 3]) p.act('workBed', i)
  assert.equal(p.state.variants.blueberry?.dew, 3)
  assert.equal((p.state.beds[4] as CropBed).trait, 'dew')
  const id = n.cook(); n.introduce(id)
  const first = getShopCommissionOffers(p.state).find(o => o.customer === 'finn')!
  p.act('acceptShopCommission', first.key)
  for (let i = 0; i < 2; i++) { n.cook(id); p.act('deliverShopCommission', String(p.state.shopCommissions.serial)) }
  const firstPayment = getShopCommission(p.state)!.total
  p.act('finishShopCommission', String(p.state.shopCommissions.serial))
  assert.equal(p.state.variants.blueberry?.dew ?? 0, 0)
  assert.equal(p.state.shopCommissions.completed.finn, 1)
  // Keep the mother planting rather than waiting for a new random weather exposure.
  n.divide(4, 0); n.grow(); n.divide(4, 2); n.divide(0, 3); n.grow()
  for (const i of [0, 2, 3]) p.act('workBed', i)
  p.visit('village'); const next = getShopCommissionOffers(p.state).find(o => o.customer === 'finn')!
  assert.equal(next.quantity, 3); p.act('acceptShopCommission', next.key)
  for (let i = 0; i < 3; i++) { n.cook(id); p.act('deliverShopCommission', String(p.state.shopCommissions.serial)) }
  const secondPayment = getShopCommission(p.state)!.total
  p.act('finishShopCommission', String(p.state.shopCommissions.serial))
  assert.equal(p.state.shopCommissions.completed.finn, 2)
  assert.equal((p.state.beds[4] as CropBed).trait, 'dew')
  assert.equal(p.state.culinary.recipes.length, 1)
  assert.equal(p.state.bayShop.sold, 1)
  assert.equal(p.state.variants.blueberry?.dew ?? 0, 0)
  assert.deepEqual([firstPayment, secondPayment], [58, 87])
  p.reload()
})
