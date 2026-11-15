import assert from 'node:assert/strict'
import test from 'node:test'
import { endDay, restoreFarm } from '../src/farm.ts'
import { quoteExpedition } from '../src/ferry-expeditions.ts'
import { expeditionWallet, receiveFerryExpedition } from '../src/harbour-economy.ts'
import { delayedLastFerryReceiptFarm, lastFerryReceiptFarm } from './fixtures/last-ferry-receipt.ts'

test('day-seven ten-coin sale remains settled history after day-eight eight-coin quote and day-ten claim', () => {
  const sent = lastFerryReceiptFarm()
  assert.equal(sent.day, 7)
  assert.equal(sent.freight.expeditions.active?.earnCoins, 10)
  endDay(sent)
  assert.equal(quoteExpedition(sent.freight.expeditions, 'mill-sale', expeditionWallet(sent))?.earnCoins, 8)
  let farm = delayedLastFerryReceiptFarm()
  assert.equal(farm.day, 10)
  assert.equal(farm.coins, 79)
  const frozen = structuredClone(farm.freight.expeditions.active!)
  assert.equal(receiveFerryExpedition(farm).ok, true)
  assert.equal(farm.coins, 89)
  assert.deepEqual(farm.freight.expeditions.last, {
    name: frozen.name, port: 'mill', day: 10, explored: false,
    settled: { id: 'mill-sale', outgoing: [{ id: 'wheat', quantity: 2 }], incoming: [], payCoins: 0, earnCoins: 10, harvestBonus: 0 },
  })
  farm = restoreFarm(JSON.parse(JSON.stringify(farm)))!
  assert.ok(farm)
  assert.equal(farm.freight.expeditions.last?.settled?.earnCoins, 10)
  const once = structuredClone(farm)
  assert.equal(receiveFerryExpedition(farm).ok, false)
  assert.deepEqual(farm, once)
})

test('old saves keep their compact legacy receipt without invented quantities', () => {
  const farm = delayedLastFerryReceiptFarm()
  receiveFerryExpedition(farm)
  const old = JSON.parse(JSON.stringify(farm))
  delete old.freight.expeditions.last.settled
  const restored = restoreFarm(old)!
  assert.ok(restored)
  assert.deepEqual(restored.freight.expeditions.last, old.freight.expeditions.last)
  assert.equal(receiveFerryExpedition(restored).ok, false)
})

test('malformed optional history falls back without discarding the farm or allowing a second award', () => {
  const farm = delayedLastFerryReceiptFarm()
  receiveFerryExpedition(farm)
  const valid = JSON.parse(JSON.stringify(farm))
  const invalid = [
    { earnCoins: 999 }, { earnCoins: 10.5 }, { earnCoins: '10' }, { earnCoins: -1 },
    { payCoins: 1 }, { harvestBonus: 4 }, { id: 'salt-buy' }, { id: 'unknown' },
    { incoming: [{ id: 'unknown', quantity: 1 }] },
    { outgoing: [{ id: 'wheat', quantity: 2.1 }] },
    { outgoing: [{ id: 'wheat', quantity: 2 }, { id: 'unknown', quantity: 1 }] },
    { outgoing: null },
  ]
  for (const patch of invalid) {
    const raw = structuredClone(valid)
    Object.assign(raw.freight.expeditions.last.settled, patch)
    const restored = restoreFarm(raw)!
    assert.ok(restored, JSON.stringify(patch))
    assert.equal(restored.freight.expeditions.last?.settled, undefined, JSON.stringify(patch))
    assert.equal(restored.coins, 89)
    assert.equal(receiveFerryExpedition(restored).ok, false)
  }
  const raw = structuredClone(valid)
  Object.assign(raw.freight.expeditions.last.settled, { phase: 'ready', serial: 999, returnsOn: 1 })
  const restored = restoreFarm(raw)!
  assert.deepEqual(restored.freight.expeditions.last, farm.freight.expeditions.last, 'restored history strips replay metadata')
  assert.equal(receiveFerryExpedition(restored).ok, false)
})

test('settled cargo is a detached snapshot, and corrupt optional history never erases a later paid voyage', async () => {
  const { sendFerryExpedition } = await import('../src/harbour-economy.ts')
  const { finishExpedition } = await import('../src/ferry-expeditions.ts')
  const farm = delayedLastFerryReceiptFarm()
  receiveFerryExpedition(farm)
  assert.equal(sendFerryExpedition(farm, 'mill-buy').ok, true)
  const paid = structuredClone(farm.freight.expeditions.active)
  const raw = JSON.parse(JSON.stringify(farm))
  raw.freight.expeditions.last.settled.earnCoins = 999
  const restored = restoreFarm(raw)!
  assert.ok(restored)
  assert.deepEqual(restored.freight.expeditions.active, paid)
  assert.equal(restored.freight.expeditions.last?.settled, undefined)
  endDay(restored)
  const active = restored.freight.expeditions.active!
  const returned = finishExpedition(restored.freight.expeditions, restored.day)!
  active.incoming[0].quantity = 20
  returned.incoming[0].quantity = 19
  assert.deepEqual(restored.freight.expeditions.last?.settled?.incoming, [{ id: 'handmade:round', quantity: 1 }])
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(restored))))
})

test('historic cargo and price survive catalog changes and retired order IDs without recalculation', () => {
  const farm = delayedLastFerryReceiptFarm()
  receiveFerryExpedition(farm)
  for (const id of ['mill-sale', 'mill-retired-order', 'pair:mill-retired-order+mill-old-basket']) {
    const raw = JSON.parse(JSON.stringify(farm))
    const old = raw.freight.expeditions.last.settled
    Object.assign(old, { id, outgoing: [{ id: 'wheat', quantity: 3 }], incoming: [{ id: 'handmade:round', quantity: 2 }], earnCoins: 17 })
    const restored = restoreFarm(raw)!
    assert.ok(restored)
    assert.deepEqual(restored.freight.expeditions.last?.settled, old)
    assert.equal(receiveFerryExpedition(restored).ok, false)
    assert.equal(restored.coins, 89)
  }
})
