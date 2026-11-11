import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ActivationKeyGuard, ActionClickGuard, isGuardedAction } from '../src/action-click-guard.ts'
import { createFarm, packEggBasket, packEggCrate, unpackEggBasket, unpackEggCrate, restoreFarm, endDay } from '../src/farm.ts'
import { sendFerryExpedition, receiveFerryExpedition } from '../src/harbour-economy.ts'

test('held Enter remains blocked after redraw moves focus to the close button', () => {
  const guard = new ActivationKeyGuard()
  assert.equal(guard.blocks({ key: 'Enter', repeat: false }, true), false)
  for (let index = 0; index < 20; index++) assert.equal(guard.blocks({ key: 'Enter', repeat: true }, false), true)
  guard.release('Enter')
  assert.equal(guard.blocks({ key: 'Enter', repeat: false }, false), false, 'a separately pressed Enter works')
})

test('release, blur and a fresh keydown cannot leave a stuck guard', () => {
  const guard = new ActivationKeyGuard()
  guard.blocks({ key: ' ', repeat: false }, true)
  assert.equal(guard.blocks({ key: ' ', repeat: true }, false), true)
  guard.release(' ')
  assert.equal(guard.blocks({ key: ' ', repeat: true }, false), false)
  guard.blocks({ key: 'Enter', repeat: false }, true); guard.reset()
  assert.equal(guard.blocks({ key: 'Enter', repeat: true }, false), false)
  guard.blocks({ key: 'Enter', repeat: false }, true)
  assert.equal(guard.blocks({ key: 'Enter', repeat: false }, false), false)
  assert.equal(guard.blocks({ key: 'Enter', repeat: true }, false), false)
  assert.equal(guard.blocks({ key: 'ArrowDown', repeat: true }, true), false)
})

test('one held activation unpacks only one basket or crate and preserves remaining packages on reload', () => {
  for (const [action, unpack, packKey, count] of [
    ['unpack-egg-basket', unpackEggBasket, 'eggBaskets', 3],
    ['unpack-egg-crate', unpackEggCrate, 'eggCrates', 5],
  ] as const) {
    assert.equal(isGuardedAction(action), true)
    const farm = createFarm(); farm.eggs = 100; farm.buildingLevels.coop = 3; farm.coopSpecialization = 'packing'
    for (let index = 0; index < 3; index++) assert.ok((packKey === 'eggBaskets' ? packEggBasket : packEggCrate)(farm).ok)
    const before = structuredClone(farm), guard = new ActivationKeyGuard()
    for (let index = 0; index < 10; index++) if (!guard.blocks({ key: 'Enter', repeat: index > 0 }, true)) assert.ok(unpack(farm).ok)
    assert.equal(farm[packKey], 2); assert.equal(farm.eggs - before.eggs, count)
    assert.equal(farm.workToday, before.workToday); assert.equal(farm.coins, before.coins)
    const restored = restoreFarm(JSON.parse(JSON.stringify(farm)))!
    assert.ok(restored); assert.equal(restored[packKey], 2)
    guard.release('Enter')
    assert.equal(guard.blocks({ key: 'Enter', repeat: false }, true), false)
    assert.ok(unpack(restored).ok); assert.equal(restored[packKey], 1)
  }
})

test('claim gesture cannot fall through to dispatch after the UI swaps its button', () => {
  assert.equal(isGuardedAction('expedition-claim'), true)
  assert.equal(isGuardedAction('expedition-send'), true)
  const farm = createFarm(); farm.boatOwned = true; farm.produce.wheat = 30; farm.coins = 100
  assert.ok(sendFerryExpedition(farm, 'mill-grain').ok); assert.ok(endDay(farm).ok)
  const ready = structuredClone(farm), guard = new ActionClickGuard()
  const first = { detail: 1, timeStamp: 100, clientX: 300, clientY: 400 }
  assert.equal(guard.blocks(first), false); guard.remember(first)
  assert.ok(receiveFerryExpedition(farm).ok)
  const received = structuredClone(farm)
  for (const detail of [1, 2]) {
    const followup = { ...first, timeStamp: 200, detail }
    if (!guard.blocks(followup)) sendFerryExpedition(farm, 'mill-grain')
    assert.deepEqual(farm, received)
  }
  assert.equal(farm.freight.expeditions.active, null)
  assert.equal(farm.freight.expeditions.serial, ready.freight.expeditions.serial)
  assert.equal(farm.freight.expeditions.completed, ready.freight.expeditions.completed + 1)
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))))
  assert.equal(guard.blocks({ ...first, timeStamp: 800 }), false)
  assert.ok(sendFerryExpedition(farm, 'mill-grain').ok, 'a deliberate later dispatch is still available')
})
