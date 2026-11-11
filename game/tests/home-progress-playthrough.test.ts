import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as farm from '../src/farm.ts'
import { getDiscoveryTask } from '../src/discovery-path.ts'
import { reserveShopGoods, transferBayGoods } from '../src/harbour-economy.ts'
import { advanceBayShop, setBayShopOpen, stockBayShop } from '../src/bay-shop-model.ts'

// A recorded playthrough from createFarm, without injected coins, stock or unlocks.
const commands = { ...farm, transferBayGoods }
const opening = JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json', import.meta.url), 'utf8')) as { name: keyof typeof commands; args: unknown[] }[]
const seen = { collections: true, islands: true }
function player() {
  let state = farm.createFarm()
  let actions = 0
  function reload() {
    const restored = farm.restoreFarm(JSON.parse(JSON.stringify(state)))
    assert.ok(restored, `Save rejected after action ${actions}`)
    state = restored
  }
  function act(name: keyof typeof commands, ...args: unknown[]) {
    const command = commands[name] as unknown as (state: farm.FarmState, ...args: unknown[]) => farm.ActionResult & { recipeId?: string }
    assert.equal(typeof command, 'function', name)
    const result = command(state, ...args)
    assert.ok(result.ok, `${name}: ${result.message}`)
    actions++
    reload()
    return result
  }
  const visit = (island: farm.IslandId) => { if (state.island !== island) act('sail', island) }
  const night = () => { visit('home'); act('endDay') }
  function fruit(id: 'apple' | 'pear', quantity: number) {
    const island = id === 'apple' ? 'home' : 'grove'
    for (let attempt = 0; state.fruit[id] < quantity; attempt++) {
      assert.ok(attempt < 30, `No progress collecting ${id}`)
      visit(island)
      const index = state.trees[island].findIndex(tree => tree?.tree === id && tree.fruitReady > 0)
      if (index >= 0) act('pickFruit', index)
      else night()
    }
  }
  function crop(id: 'carrot' | 'wheat', quantity: number) {
    for (let attempt = 0; state.produce[id] < quantity; attempt++) {
      assert.ok(attempt < 30, `No progress growing ${id}`)
      visit('home')
      const ripe = state.beds.findIndex((bed, index) => bed.kind === 'crop' && bed.crop === id && farm.getBedAction(state, index).kind === 'harvest')
      if (ripe >= 0) { act('workBed', ripe); continue }
      let index = state.beds.findIndex(bed => bed.kind === 'crop' && bed.crop === id)
      if (index < 0) {
        act('selectSeed', id)
        if (!state.seeds[id]) act('buySeeds', id)
        index = state.beds.findIndex(bed => bed.kind === 'tilled' || bed.kind === 'empty')
        assert.ok(index >= 0, 'A usable plot remains')
        if (state.beds[index].kind === 'empty') act('workBed', index)
        act('workBed', index)
      }
      if (!state.water) act('refillWater')
      const bed = state.beds[index]
      if (bed.kind === 'crop' && !bed.watered) act('workBed', index)
      night()
    }
  }
  for (const command of opening) act(command.name, ...command.args)
  return { get state() { return state }, get actions() { return actions }, act, visit, night, fruit, crop, reload }
}

test('a fresh farm reaches both neighbours and a first shop sale without injected resources', () => {
  const p = player()
  assert.equal(p.actions, 107)
  assert.equal(p.state.day, 14)
  assert.equal(p.state.coins, 68)
  assert.deepEqual(p.state.buildingLevels, { farmhouse: 2, coop: 2, well: 2 })
  assert.deepEqual(p.state.village.residents, ['bea', 'finn'])
  assert.equal(p.state.village.meals, 2)
  assert.equal(getDiscoveryTask(p.state, seen)?.id, 'first-shop')
  assert.equal(p.state.dishes.orchardTart, 1)
  assert.ok(reserveShopGoods(p.state, 'dish:orchardTart', 1))
  assert.ok(stockBayShop(p.state.bayShop, 0, { id: 'dish:orchardTart', identity: 'dish:orchardTart', name: 'Фруктовый пирог',
    image: '/art/lavender/ui-tart.webp', basePrice: 25, tags: ['apple', 'wheat', 'eggs', 'fruit', 'hearty', 'portable'] }, 1))
  setBayShopOpen(p.state.bayShop, true)
  for (let tick = 0; tick < 30; tick++) {
    for (const sale of advanceBayShop(p.state.bayShop, 1000)) p.state.coins += sale.price
    p.reload()
  }
  setBayShopOpen(p.state.bayShop, false)
  p.reload()
  assert.equal(p.state.coins, 93)
  assert.equal(p.state.dishes.orchardTart, 0)
  assert.equal(p.state.bayShop.sold, 1)
  assert.equal(p.state.bayShop.slots[0]?.quantity, 0)
  assert.equal(getDiscoveryTask(p.state, seen)?.id, 'own-recipe')
})

test('the earned harbour supports repeat recipes, both tastings and a complete harvest festival across reloads', () => {
  const p = player()
  // Sell the earned tart at the ordinary market for the same 25 coins as the UI shop test.
  p.visit('home'); p.act('sellMarketItem', 'dishes:orchardTart', 1)
  p.fruit('apple', 1); p.fruit('pear', 1); p.visit('village')
  // This is a model receipt, not a claim that this test performs the manual cooking gesture.
  const recipe = p.act('completeSignature', { base: 'preserves', ingredients: [{ id: 'apple', quantity: 1 }, { id: 'pear', quantity: 1 }] },
    { family: 'preserves', processing: 'silky', fruit: [], steps: ['mix', 'pour'] }).recipeId!
  p.act('tasteSignature', recipe, 'bea')
  p.fruit('apple', 1); p.fruit('pear', 1); p.visit('village')
  p.act('repeatSignature', recipe); p.act('tasteSignature', recipe, 'finn')
  assert.equal(p.state.culinary.tastings.bea.liked, 1)
  assert.equal(p.state.culinary.tastings.finn.visits, 1)
  p.act('beginFestival', 'harvest')
  p.fruit('apple', 3); p.visit('village')
  p.act('contributeFestival', 'participation', 'harvest')
  for (let i = 0; i < 3; i++) p.act('contributeFestival', 'fruit', 'apple')
  p.night(); p.crop('carrot', 3); p.crop('wheat', 2); p.visit('village')
  for (let i = 0; i < 3; i++) p.act('contributeFestival', 'roots', 'carrot')
  for (let i = 0; i < 2; i++) p.act('contributeFestival', 'greens', 'wheat')
  p.night(); p.fruit('apple', 2); p.fruit('pear', 2); p.visit('village')
  p.act('repeatSignature', recipe); p.act('repeatSignature', recipe)
  p.act('contributeFestival', 'treat', `signature:${recipe}`)
  p.act('contributeFestival', 'treat', `signature:${recipe}`)
  p.night(); p.visit('village')
  const before = p.state.coins, reward = farm.getFestivalStatus(p.state).active!.reward
  p.act('finishFestival')
  assert.equal(p.state.day, 21)
  assert.equal(reward, 91)
  assert.equal(p.state.coins, before + reward)
  assert.equal(p.state.coins, 184)
  assert.equal(p.state.festivals.completed.harvest, 1)
  assert.equal(p.state.freight.harvestStore, 1)
  assert.equal(p.state.culinary.recipes.length, 1)
  assert.equal(p.state.culinary.recipes[0].batches, 4)
  assert.equal(p.state.culinary.stock[recipe], 0)
  const finished = structuredClone(p.state)
  assert.equal(farm.finishFestival(p.state).ok, false)
  assert.deepEqual(p.state, finished, 'A repeated finish never pays twice')
})
