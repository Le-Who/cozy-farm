import test from 'node:test'
import assert from 'node:assert/strict'
import { createFarm, completeSignature, repeatSignature, restoreCurrentFarm, getMarketBasket, sellMarketBasket, nameSignature, type FarmState } from '../src/farm.ts'
import { recipeSurplusQuote, sellRecipeSurplus } from '../src/recipe-surplus.ts'

function tart() {
  const farm = createFarm()
  farm.fruit.apple = 2; farm.produce.wheat = 1; farm.eggs = 1
  const made = completeSignature(farm, { base: 'tart', ingredients: [{ id: 'apple', quantity: 2 }] },
    { family: 'decorate', fruit: [], steps: ['fruit', 'bake'] })
  assert.ok(made.ok)
  farm.fruit.apple = 10; farm.produce.wheat = 8; farm.eggs = 7
  farm.produce.carrot = 11; farm.fruit.pear = 9; farm.variants.apple = { rainbow: 4 }
  farm.discoveries.apple = { regular: true, rainbow: true }
  return { farm, recipeId: made.recipeId! }
}

test('a reviewed batch sells only exact recipe ingredient surplus and leaves a real triple repeat', () => {
  const { farm, recipeId } = tart(), before = structuredClone(farm)
  const quote = recipeSurplusQuote(farm, recipeId, 3)!
  assert.equal(quote.quantity, 3); assert.equal(quote.items, 13); assert.equal(quote.total, 43); assert.equal(quote.missing, 0)
  assert.deepEqual(quote.lines.map(({ key, stock, required, kept, sell, missing }) => ({ key, stock, required, kept, sell, missing })), [
    { key: 'fruit:apple', stock: 10, required: 6, kept: 6, sell: 4, missing: 0 },
    { key: 'produce:wheat', stock: 8, required: 3, kept: 3, sell: 5, missing: 0 },
    { key: 'eggs', stock: 7, required: 3, kept: 3, sell: 4, missing: 0 },
  ])
  assert.deepEqual(farm, before)
  assert.ok(sellRecipeSurplus(farm, quote.token).ok)
  const expected = structuredClone(before)
  expected.fruit.apple = 6; expected.produce.wheat = 3; expected.eggs = 3
  expected.coins += 51; expected.workToday++; expected.progress.sell++
  assert.deepEqual(farm, expected, 'one normal sale, including its initial reward, and no unrelated inventory changes')
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))), farm)
  const once = structuredClone(farm)
  assert.equal(sellRecipeSurplus(farm, quote.token).ok, false); assert.deepEqual(farm, once)
  assert.ok(repeatSignature(farm, recipeId, undefined, 3).ok)
  assert.equal(farm.fruit.apple, 0); assert.equal(farm.produce.wheat, 0); assert.equal(farm.eggs, 0)
  assert.equal(farm.culinary.stock[recipeId], 4)
})

test('a mixed exact variant requirement may remain deficient without selling it or substituting ordinary fruit', () => {
  const farm = createFarm()
  farm.buildingLevels.farmhouse = 2
  farm.fruit.apple = 1; farm.variants.apple = { rainbow: 1 }; farm.discoveries.apple = { regular: true, rainbow: true, star: true }
  const made = completeSignature(farm, { base: 'preserves', ingredients: [{ id: 'apple', quantity: 1 }, { id: 'apple', trait: 'rainbow', quantity: 1 }] },
    { family: 'preserves', processing: 'silky', fruit: [], steps: ['stir', 'pour'] })
  assert.ok(made.ok)
  farm.fruit.apple = 10; farm.variants.apple = { rainbow: 2, star: 7 }
  farm.fruit.pear = 12; farm.produce.wheat = 8; farm.eggs = 9
  farm.freight.warehouses.home = { apple: 9, wheat: 2 }
  const before = structuredClone(farm), quote = recipeSurplusQuote(farm, made.recipeId!, 3)!
  assert.equal(quote.missing, 1); assert.equal(quote.items, 7); assert.equal(quote.total, 28)
  assert.deepEqual(quote.lines.map(line => [line.key, line.required, line.kept, line.sell, line.missing]), [
    ['fruit:apple', 3, 3, 7, 0], ['variants:apple:rainbow', 3, 2, 0, 1],
  ])
  assert.ok(sellRecipeSurplus(farm, quote.token).ok)
  const expected = structuredClone(before)
  expected.fruit.apple = 3; expected.coins += 36; expected.workToday++; expected.progress.sell++
  assert.deepEqual(farm, expected)
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))), farm)
  const afterSale = structuredClone(farm)
  assert.equal(repeatSignature(farm, made.recipeId!, undefined, 3).ok, false)
  assert.deepEqual(farm, afterSale)
})

test('one repeat aggregates the same fruit twice and treats each exact variant as its own sale line', () => {
  const farm = createFarm(); farm.buildingLevels.farmhouse = 2
  farm.variants.blueberry = { star: 2 }; farm.discoveries.blueberry = { star: true, rainbow: true }
  const made = completeSignature(farm, { base: 'preserves', ingredients: [{ id: 'blueberry', trait: 'star', quantity: 1 }, { id: 'blueberry', trait: 'star', quantity: 1 }] },
    { family: 'preserves', processing: 'bright', fruit: [], steps: ['stir', 'pour'] })
  assert.ok(made.ok)
  farm.variants.blueberry = { star: 5, rainbow: 8 }; farm.produce.blueberry = 12; farm.progress.sell = 1
  const quote = recipeSurplusQuote(farm, made.recipeId!, 1)!, before = structuredClone(farm)
  assert.equal(quote.lines.length, 1)
  assert.deepEqual(quote.lines[0], {
    item: { kind: 'variants', item: 'blueberry', trait: 'star', quantity: 2 }, key: 'variants:blueberry:star',
    stock: 5, required: 2, kept: 2, sell: 3, missing: 0, price: 12, total: 36,
  })
  assert.ok(sellRecipeSurplus(farm, quote.token).ok)
  const expected = structuredClone(before)
  expected.variants.blueberry!.star = 2; expected.coins += 36; expected.workToday++; expected.progress.sell++
  assert.deepEqual(farm, expected)
  assert.ok(repeatSignature(farm, made.recipeId!, undefined, 1).ok)
  assert.equal(farm.variants.blueberry!.star, undefined)
  assert.equal(farm.variants.blueberry!.rainbow, 8); assert.equal(farm.produce.blueberry, 12)
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))), farm)
})

test('a full recipe snapshot and every relevant balance, day, work or price change invalidate the review', () => {
  for (const change of [
    (f: FarmState) => { f.day++ },
    (f: FarmState) => { f.workToday++ },
    (f: FarmState) => { f.progress.sell++ },
    (f: FarmState) => { f.coins++ },
    (f: FarmState) => { f.fruit.apple-- },
    (f: FarmState) => { f.eggs = 0 },
    (f: FarmState) => { f.produce.wheat = 2 },
    (f: FarmState) => { f.projects.fair = { 'dishes:appleJam': 1, eggBaskets: 1, 'produce:carrot': 4, 'produce:wheat': 3 } },
    (f: FarmState) => { assert.ok(nameSignature(f, 's1', 'Другой тарт').ok) },
    (f: FarmState) => { f.culinary.recipes[0].result.fruit = [{ ingredientId: 'apple', x: .2, y: .3, angle: .4 }] },
    (f: FarmState) => { f.culinary.recipes[0].ingredients = [{ id: 'pear', quantity: 2 }] },
    (f: FarmState) => { f.culinary.recipes = [] },
    (f: FarmState) => { f.island = 'grove' },
  ]) {
    const { farm, recipeId } = tart(), token = recipeSurplusQuote(farm, recipeId, 3)!.token
    change(farm)
    const before = structuredClone(farm)
    assert.equal(sellRecipeSurplus(farm, token).ok, false)
    assert.deepEqual(farm, before)
  }
  const { farm, recipeId } = tart(); farm.eggs = 1
  const token = recipeSurplusQuote(farm, recipeId, 3)!.token
  farm.eggs = 2 // Both reviews sell zero eggs; the changed shortage still requires a fresh view.
  const before = structuredClone(farm)
  assert.equal(sellRecipeSurplus(farm, token).ok, false); assert.deepEqual(farm, before)
})

test('no surplus, invalid choices, malformed or altered tokens never sell or claim a reward', () => {
  const { farm, recipeId } = tart(), token = recipeSurplusQuote(farm, recipeId, 1)!.token
  for (const bad of [undefined, null, 1, {}, '', 'x'.repeat(100001), token + 'x', token.replace(';s1;', ';s2;'), token.replace(';1;', ';3;'), token.replace(';1;', ';01;')]) {
    const before = structuredClone(farm)
    assert.equal(sellRecipeSurplus(farm, bad).ok, false); assert.deepEqual(farm, before)
  }
  assert.equal(recipeSurplusQuote(farm, 's999', 1), undefined)
  for (const quantity of [0, 2, -1, .5, NaN, Infinity, '1']) assert.equal(recipeSurplusQuote(farm, recipeId, quantity as 1), undefined)
  farm.fruit.apple = 2; farm.produce.wheat = 1; farm.eggs = 0
  const quote = recipeSurplusQuote(farm, recipeId, 1)!, before = structuredClone(farm)
  assert.equal(quote.items, 0); assert.equal(quote.total, 0); assert.equal(quote.missing, 1)
  assert.equal(sellRecipeSurplus(farm, quote.token).ok, false); assert.deepEqual(farm, before)
  for (const island of ['grove', 'cape', 'village'] as const) { farm.island = island; assert.equal(recipeSurplusQuote(farm, recipeId, 1), undefined) }
})

test('unsafe final totals and counters reject before removing any ingredient, including the initial reward', () => {
  for (const change of [
    (f: FarmState) => { f.coins = Number.MAX_SAFE_INTEGER },
    (f: FarmState) => { f.coins = Number.MAX_SAFE_INTEGER - 43 }, // Base sale fits, but the ordinary reward does not.
    (f: FarmState) => { f.workToday = Number.MAX_SAFE_INTEGER },
    (f: FarmState) => { f.progress.sell = Number.MAX_SAFE_INTEGER },
    (f: FarmState) => { f.fruit.apple = Number.MAX_SAFE_INTEGER },
    (f: FarmState) => { f.fruit.apple = -1 },
  ]) {
    const { farm, recipeId } = tart(), token = recipeSurplusQuote(farm, recipeId, 3)!.token
    change(farm)
    const before = structuredClone(farm)
    assert.equal(recipeSurplusQuote(farm, recipeId, 3), undefined)
    assert.equal(sellRecipeSurplus(farm, token).ok, false); assert.deepEqual(farm, before)
  }
  const { farm, recipeId } = tart(); farm.coins = Number.MAX_SAFE_INTEGER - 51
  assert.ok(sellRecipeSurplus(farm, recipeSurplusQuote(farm, recipeId, 3)!.token).ok)
  assert.equal(farm.coins, Number.MAX_SAFE_INTEGER)
  assert.deepEqual(restoreCurrentFarm(JSON.parse(JSON.stringify(farm))), farm)
})

test('market basket validates all lines together and never turns an invalid or duplicate line into a partial sale', () => {
  const { farm } = tart(), requests = [{ key: 'fruit:apple', quantity: 4 }, { key: 'produce:wheat', quantity: 5 }]
  const quote = getMarketBasket(farm, requests)!, before = structuredClone(farm)
  assert.equal(quote.items, 9); assert.equal(quote.total, 31); assert.deepEqual(farm, before)
  for (const bad of [
    [], [...requests, requests[0]], [...requests, { key: 'eggs', quantity: 8 }],
    [...requests, { key: '__proto__', quantity: 1 }], [...requests, { key: 'fruit:pear', quantity: 0 }],
    [...requests, { key: 'fruit:pear', quantity: .5 }], [...requests, { key: 'fruit:pear', quantity: -1 }],
    [...requests, { key: 'fruit:pear', quantity: Infinity }], null, {},
  ]) {
    assert.equal(getMarketBasket(farm, bad as typeof requests), undefined)
    assert.equal(sellMarketBasket(farm, bad as typeof requests, quote.token).ok, false)
    assert.deepEqual(farm, before)
  }
  assert.equal(sellMarketBasket(farm, requests, quote.token + 'x').ok, false); assert.deepEqual(farm, before)
  farm.produce.wheat++
  const changed = structuredClone(farm)
  assert.equal(sellMarketBasket(farm, requests, quote.token).ok, false); assert.deepEqual(farm, changed)
  const fresh = getMarketBasket(farm, requests)!
  assert.ok(sellMarketBasket(farm, requests, fresh.token).ok)
  assert.equal(farm.coins, before.coins + 39); assert.equal(farm.workToday, before.workToday + 1); assert.equal(farm.progress.sell, 1)
})
