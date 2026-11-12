import test from 'node:test'
import assert from 'node:assert/strict'
import { createFarm, completeSignature, repeatSignature, restoreCurrentFarm } from '../src/farm.ts'
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
