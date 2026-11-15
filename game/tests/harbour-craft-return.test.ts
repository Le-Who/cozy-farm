import assert from 'node:assert/strict'
import test from 'node:test'
import { getDiscoveryTask } from '../src/discovery-path.ts'
import { getResidentService, runResidentService } from '../src/farm.ts'
import { getShopCommissionOffers } from '../src/shop-commissions.ts'
import { firstCommissionReturnPlayer, harbourCraftReturnPlayer } from './fixtures/harbour-craft-return.ts'

const seen = { collections: true, islands: true }

test('a first liked purchase still introduces commissions until one is actually finished', () => {
  const { p } = firstCommissionReturnPlayer(false)
  assert.equal(getDiscoveryTask(p.state, seen)?.id, 'first-commission')
  p.act('acceptShopCommission', getShopCommissionOffers(p.state)[0].key)
  assert.equal(getDiscoveryTask(p.state, seen)?.id, 'shop-commission')
  p.act('cancelShopCommission', String(p.state.shopCommissions.serial))
  assert.equal(getDiscoveryTask(p.state, seen)?.id, 'first-commission')
  p.night(); p.visit('village')
  assert.equal(getDiscoveryTask(p.state, seen)?.id, 'first-commission')
})

test('a completed first commission does not restart onboarding when repeat offers return next morning', () => {
  const { p } = firstCommissionReturnPlayer()
  assert.equal(p.state.day, 16)
  assert.equal(p.state.shopCommissions.completed.bea, 1)
  assert.equal(getDiscoveryTask(p.state, seen)?.id, 'first-festival')
  p.night(); p.visit('village'); p.reload()
  assert.equal(p.state.day, 17)
  const before = structuredClone(p.state), offers = getShopCommissionOffers(p.state)
  assert.equal(offers[0].quantity, 3, 'the earned repeat order remains available')
  assert.equal(getDiscoveryTask(p.state, seen)?.id, 'first-festival')
  assert.deepEqual(p.state, before, 'guidance is read-only')
  p.act('acceptShopCommission', offers[0].key)
  assert.equal(getDiscoveryTask(p.state, seen)?.id, 'shop-commission', 'an explicitly accepted repeat order retains priority')
})

test('an earned Bea bonus remains reachable after a day away and is consumed only by explicit baking', () => {
  const { p } = harbourCraftReturnPlayer()
  assert.equal(p.state.day, 25)
  assert.equal(p.state.festivals.completed.harvest, 1)
  p.night(); p.visit('village'); p.reload()
  assert.equal(getShopCommissionOffers(p.state).length, 1)
  assert.equal(p.state.culinary.tastings.bea.bonus, true)
  assert.equal(getResidentService(p.state, 'bea').available, true)
  const before = structuredClone(p.state)
  for (let i = 0; i < 3; i++) {
    assert.equal(getDiscoveryTask(p.state, seen)?.id, 'neighbour-service')
    assert.equal(getDiscoveryTask(p.state, seen)?.action.value, '0')
  }
  assert.deepEqual(p.state, before, 'opening or rereading the guide never spends the bonus')
  p.act('runResidentService', 'bea', 'round')
  assert.equal(p.state.handmade.round, before.handmade.round + 4)
  assert.equal(p.state.produce.wheat, before.produce.wheat - 4)
  assert.equal(p.state.eggs, before.eggs - 2)
  assert.equal(p.state.coins, before.coins)
  assert.equal(p.state.culinary.tastings.bea.bonus, false)
  const baked = structuredClone(p.state)
  assert.equal(runResidentService(p.state, 'bea', 'round').ok, false)
  assert.deepEqual(p.state, baked)
  assert.equal(getShopCommissionOffers(p.state).length, 1, 'crafting does not remove the repeat order')
})
