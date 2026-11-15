import assert from 'node:assert/strict'
import test from 'node:test'
import { getDiscoveryTask } from '../src/discovery-path.ts'
import { getResidentService, runResidentService } from '../src/farm.ts'
import { getShopCommissionOffers } from '../src/shop-commissions.ts'
import { harbourCraftReturnPlayer } from './fixtures/harbour-craft-return.ts'

const seen = { collections: true, islands: true }

test('the earned service routes Home to the harbour without granting remote baking or spending anything', () => {
  const { p } = harbourCraftReturnPlayer()
  p.night(); p.reload()
  assert.equal(p.state.day, 26)
  assert.equal(p.state.island, 'home')
  const before = structuredClone(p.state)
  for (let i = 0; i < 3; i++) {
    const task = getDiscoveryTask(p.state, seen)
    assert.equal(task?.id, 'neighbour-service')
    assert.deepEqual(task?.action, { label: 'В Лавандовую гавань', target: 'sail', value: 'village' })
  }
  assert.deepEqual(p.state, before)
  assert.equal(getResidentService(p.state, 'bea').available, false)
  assert.equal(runResidentService(p.state, 'bea', 'round').ok, false)
  assert.deepEqual(p.state, before, 'a discovery preview cannot authorize a remote service')

  p.act('sail', 'village')
  const arrived = structuredClone(p.state), task = getDiscoveryTask(p.state, seen)
  assert.deepEqual(task?.action, { label: 'В гости: Беа', target: 'visit-cottage', value: '0' })
  assert.equal(getResidentService(p.state, 'bea').available, true)
  assert.deepEqual(p.state, arrived, 'arrival guidance does not bake or move cargo')
  p.act('runResidentService', 'bea', 'round')
  assert.equal(p.state.coins, before.coins)
  assert.equal(p.state.produce.wheat, before.produce.wheat - 4)
  assert.equal(p.state.eggs, before.eggs - 2)
  assert.equal(p.state.handmade.round, before.handmade.round + 4)
  assert.equal(p.state.culinary.tastings.bea.bonus, false)
})

test('an explicitly accepted order or festival keeps priority over a return service', () => {
  const { p } = harbourCraftReturnPlayer()
  p.night(); p.visit('village')
  p.act('acceptShopCommission', getShopCommissionOffers(p.state)[0].key)
  p.visit('home')
  const before = structuredClone(p.state), task = getDiscoveryTask(p.state, seen)
  assert.equal(task?.id, 'shop-commission')
  assert.equal(task?.action.target, 'sail')
  assert.equal(task?.action.value, 'village')
  assert.deepEqual(p.state, before)
  p.visit('village'); p.act('cancelShopCommission', String(p.state.shopCommissions.serial))
  p.act('beginFestival', 'harvest'); p.visit('home')
  const festival = structuredClone(p.state)
  assert.equal(getDiscoveryTask(p.state, seen)?.id, 'festival-preparation')
  assert.deepEqual(p.state, festival)
})

test('destination preview still respects consumed service, prepared scouting and actual missing supplies', () => {
  const { p } = harbourCraftReturnPlayer()
  p.act('runResidentService', 'bea', 'round')
  p.act('runResidentService', 'finn')
  p.visit('home')
  const used = structuredClone(p.state)
  assert.equal(getDiscoveryTask(p.state, seen), undefined)
  assert.deepEqual(p.state, used)
  p.night(); p.reload()
  const morning = structuredClone(p.state)
  assert.equal(p.state.produce.wheat, 1)
  assert.equal(p.state.eggs, 1)
  assert.equal(p.state.village.scouting, true)
  assert.equal(getDiscoveryTask(p.state, seen), undefined)
  assert.deepEqual(p.state, morning)
})
