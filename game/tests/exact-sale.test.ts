import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFarm, restoreFarm, sellMarketItem, completeSignature, repeatSignature, sellSignature } from '../src/farm.ts'
import { ActionClickGuard } from '../src/action-click-guard.ts'
import { exactSaleQuote, saleStock } from '../src/exact-sale.ts'

test('selling precisely 28 of 30 apples survives reload and leaves variants untouched', () => {
  const farm = createFarm()
  farm.fruit.apple = 30; farm.variants.apple = { rainbow: 2 }; farm.progress.sell = 1
  const before = structuredClone(farm)
  assert.deepEqual(exactSaleQuote('28', 30, 4), { valid: true, quantity: 28, total: 112, remaining: 2 })
  assert.ok(sellMarketItem(farm, 'fruit:apple', 28).ok)
  assert.equal(farm.fruit.apple, 2)
  assert.equal(farm.coins - before.coins, 112)
  assert.deepEqual(farm.variants.apple, before.variants.apple)
  assert.equal(farm.workToday, before.workToday + 1)
  const restored = restoreFarm(JSON.parse(JSON.stringify(farm)))!
  assert.ok(restored); assert.equal(restored.fruit.apple, 2)
  assert.equal(restored.coins, farm.coins)
})

test('exact sales reject fractional, missing, oversized and overflowing quantities atomically', () => {
  const farm = createFarm(); farm.fruit.apple = 30
  for (const quantity of [0, -1, .5, 31, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    const before = structuredClone(farm)
    assert.equal(sellMarketItem(farm, 'fruit:apple', quantity).ok, false)
    assert.deepEqual(farm, before)
  }
  for (const raw of ['', '0', '-1', '2.5', '31', '2e1', 'Infinity', 'NaN']) assert.equal(exactSaleQuote(raw, 30, 4).valid, false)
  for (const mutation of ['coins', 'workToday'] as const) {
    const full = createFarm(); full.fruit.apple = 30; full[mutation] = Number.MAX_SAFE_INTEGER
    const before = structuredClone(full)
    assert.equal(sellMarketItem(full, 'fruit:apple', 28).ok, false)
    assert.deepEqual(full, before)
  }
})

test('market default remains one and special stock can be sold without using ordinary goods', () => {
  const farm = createFarm(); farm.fruit.apple = 30; farm.variants.apple = { rainbow: 4 }
  assert.ok(sellMarketItem(farm, 'fruit:apple').ok)
  assert.equal(farm.fruit.apple, 29)
  assert.ok(sellMarketItem(farm, 'variants:apple:rainbow', 3).ok)
  assert.equal(farm.fruit.apple, 29); assert.equal(farm.variants.apple.rainbow, 1)
})

test('recipe selection sells the exact chosen stock and preserves saved recipe identity', () => {
  const farm = createFarm(); farm.buildingLevels.farmhouse = 2
  farm.fruit.apple = farm.eggs = farm.produce.wheat = 100
  const id = completeSignature(farm, { base: 'tart', ingredients: [{ id: 'apple', quantity: 2 }] }, { family: 'decorate', fruit: [{ ingredientId: 'apple', x: .2, y: -.3, angle: .4 }], steps: ['fruit', 'dust'] }).recipeId!
  repeatSignature(farm, id, undefined, 3)
  const recipe = structuredClone(farm.culinary.recipes[0]), stock = saleStock(farm, { kind: 'signature', key: id })!
  assert.equal(stock.count, 4)
  assert.ok(sellSignature(farm, id, 3).ok)
  assert.equal(farm.culinary.stock[id], 1)
  assert.deepEqual(farm.culinary.recipes[0], recipe)
  assert.equal(restoreFarm(JSON.parse(JSON.stringify(farm)))!.culinary.stock[id], 1)
})

const click = (timeStamp: number, detail = 1, clientX = 20, clientY = 30) => ({ timeStamp, detail, clientX, clientY })
test('click guard stops double-click after replaced DOM and leaked clicks on a different action', () => {
  const guard = new ActionClickGuard()
  assert.equal(guard.blocks(click(100)), false); guard.remember(click(100))
  assert.equal(guard.blocks(click(180, 2)), true)
  assert.equal(guard.blocks(click(200, 1)), true, 'replacement targets may restart click detail')
  assert.equal(guard.blocks(click(250, 1, 23, 32)), true)
  assert.equal(guard.blocks(click(250, 1, 100, 32)), false, 'a distinct location remains usable')
  assert.equal(guard.blocks(click(601, 1)), false, 'an independent later click works')
})

test('keyboard activation is independent and a blocked follow-up does not renew the guard', () => {
  const guard = new ActionClickGuard(); guard.remember(click(100))
  assert.equal(guard.blocks(click(150, 0)), false)
  guard.remember(click(150, 0))
  assert.equal(guard.blocks(click(550, 2)), true)
  assert.equal(guard.blocks(click(610)), false)
})
