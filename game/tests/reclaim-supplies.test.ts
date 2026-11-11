import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createFarm, restoreFarm, packEggBasket, packEggCrate, unpackEggBasket, unpackEggCrate,
  getEggUnpackAction, getHarborOrder, getHarborWithdrawal, deliverHarborOrder, withdrawHarborSupplies,
} from '../src/farm.ts'

const reload = (farm: ReturnType<typeof createFarm>) => {
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)))
  assert.ok(restored)
  return restored
}
function coop() {
  const farm = createFarm()
  farm.buildingLevels.coop = 3
  farm.coopSpecialization = 'packing'
  farm.eggs = 11
  farm.variants.egg = { star: 2 }
  farm.discoveries.egg = { star: true }
  return farm
}
function harbor() {
  const farm = createFarm()
  farm.day = 5
  farm.boatOwned = true
  farm.buildingLevels.farmhouse = 3
  farm.farmhouseSpecialization = 'bakery'
  farm.projects.dock = { 'dishes:appleJam': 1, 'fruit:pear': 2, seaSalt: 2 }
  farm.island = 'grove'
  farm.fishCaughtToday.grove = 1
  farm.saltGatheredToday = true
  return farm
}

for (const [kind, pack, unpack, field, amount] of [
  ['basket', packEggBasket, unpackEggBasket, 'eggBaskets', 3],
  ['crate', packEggCrate, unpackEggCrate, 'eggCrates', 5],
] as const) {
  test(`unpacking one ${kind} returns exactly ${amount} previously packed ordinary eggs after reload`, () => {
    let farm = coop()
    assert.equal(pack(farm).ok, true)
    farm = reload(farm)
    const before = structuredClone(farm)
    assert.equal(getEggUnpackAction(farm, kind).available, true)
    assert.equal(getEggUnpackAction(farm, kind).eggs, amount)
    assert.equal(unpack(farm).ok, true)
    const expected = structuredClone(before)
    expected.eggs += amount
    expected[field] -= 1
    assert.deepEqual(farm, expected, 'no rewards, work refunds, discovery or rare-egg conversion')
    farm = reload(farm)
    const empty = structuredClone(farm)
    assert.equal(unpack(farm).ok, false)
    assert.deepEqual(farm, empty)
  })

  test(`unpacking ${kind} cannot create eggs from an empty package, a different island, or overflow`, () => {
    const farm = coop()
    for (const state of [
      { ...farm, [field]: 0 },
      { ...farm, [field]: 1, island: 'grove' as const },
      { ...farm, [field]: 1, eggs: Number.MAX_SAFE_INTEGER - amount + 1 },
    ]) {
      const before = structuredClone(state)
      assert.equal(getEggUnpackAction(state, kind).available, false)
      assert.equal(unpack(state).ok, false)
      assert.deepEqual(state, before)
    }
  })
}

test('unpacking an owned basket does not require constructing the packing upgrade', () => {
  const farm = createFarm()
  farm.eggBaskets = 2
  assert.equal(unpackEggBasket(farm).ok, true)
  assert.equal(farm.eggBaskets, 1)
  assert.equal(farm.eggs, 3)
})

test('partial harbour fish can be returned once after reload without rewards or replenishing daily resources', () => {
  let farm = harbor()
  farm.fish.seaBass = 1
  assert.equal(deliverHarborOrder(farm).ok, true)
  farm = reload(farm)
  const before = structuredClone(farm)
  assert.equal(getHarborWithdrawal(farm).available, true)
  assert.deepEqual(getHarborWithdrawal(farm).items, [{ kind: 'fish', item: 'seaBass', quantity: 1 }])
  assert.equal(withdrawHarborSupplies(farm).ok, true)
  const expected = structuredClone(before)
  expected.fish.seaBass += 1
  expected.harborSupplies = {}
  assert.deepEqual(farm, expected)
  farm = reload(farm)
  const returned = structuredClone(farm)
  assert.equal(withdrawHarborSupplies(farm).ok, false)
  assert.deepEqual(farm, returned)
})

test('mixed partial harbour supplies return their exact amounts without changing the selected order', () => {
  let farm = harbor()
  farm.orders.harbor = { completed: 1, deliveredOn: 4 }
  farm.dishes.farmhouseBread = 1
  farm.seaSalt = 1
  assert.equal(deliverHarborOrder(farm).ok, true)
  farm = reload(farm)
  const order = getHarborOrder(farm)!, before = structuredClone(farm)
  assert.equal(order.name, 'Посылка из Солёной рощи')
  assert.equal(withdrawHarborSupplies(farm).ok, true)
  const expected = structuredClone(before)
  expected.dishes.farmhouseBread += 1
  expected.seaSalt += 1
  expected.harborSupplies = {}
  assert.deepEqual(farm, expected)
  assert.equal(getHarborOrder(farm)?.name, order.name)
  assert.equal(getHarborOrder(farm)?.reward, order.reward)
  assert.ok(reload(farm))
})

test('a returned partial order can be filled later and pays exactly once without resetting the daily delivery quota', () => {
  const farm = harbor()
  farm.fish.seaBass = 1
  assert.equal(deliverHarborOrder(farm).ok, true)
  assert.equal(withdrawHarborSupplies(farm).ok, true)
  farm.dishes.farmhouseBread = 1
  const coins = farm.coins, reward = getHarborOrder(farm)!.reward
  assert.equal(deliverHarborOrder(farm).ok, true)
  assert.equal(farm.coins, coins + reward)
  assert.equal(farm.orders.harbor.completed, 1)
  assert.equal(farm.orders.harbor.deliveredOn, farm.day)
  const complete = structuredClone(farm)
  assert.equal(getHarborWithdrawal(farm).available, false)
  assert.equal(withdrawHarborSupplies(farm).ok, false)
  assert.equal(deliverHarborOrder(farm).ok, false)
  assert.deepEqual(farm, complete)
  assert.ok(reload(farm))
})

test('harbour withdrawal is atomic when one destination inventory would overflow', () => {
  const farm = harbor()
  farm.orders.harbor = { completed: 1, deliveredOn: 4 }
  farm.dishes.farmhouseBread = farm.seaSalt = 1
  assert.equal(deliverHarborOrder(farm).ok, true)
  farm.seaSalt = Number.MAX_SAFE_INTEGER
  const before = structuredClone(farm)
  assert.equal(getHarborWithdrawal(farm).available, false)
  assert.equal(withdrawHarborSupplies(farm).ok, false)
  assert.deepEqual(farm, before, 'even the safe bread portion must remain reserved')
})

test('harbour withdrawal rejects inaccessible, completed or malformed reservations without changing anything', () => {
  const farm = harbor()
  farm.fish.seaBass = 1
  assert.equal(deliverHarborOrder(farm).ok, true)
  const states = [
    { ...farm, island: 'home' as const },
    { ...farm, harborSupplies: { 'fish:seaBass': -1 } },
    { ...farm, harborSupplies: { 'fish:seaBass': 2 } },
    { ...farm, harborSupplies: { 'fish:seaBass': 1, eggs: 5 } },
    { ...farm, harborSupplies: { 'fish:seaBass': 1, 'dishes:farmhouseBread': 1 } },
    { ...farm, orders: { ...farm.orders, harbor: { completed: 1, deliveredOn: farm.day } } },
  ]
  for (const state of states) {
    const before = structuredClone(state)
    assert.equal(withdrawHarborSupplies(state).ok, false)
    assert.deepEqual(state, before)
  }
})
