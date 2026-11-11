import assert from 'node:assert/strict'
import { test } from 'node:test'
import { recipeWarehouseReturnFixture } from './fixtures/recipe-warehouse-return.ts'
import { getRecipeRepeatGuide } from '../src/recipe-repeat-guidance.ts'
import { getRequirementHint } from '../src/requirement-guidance.ts'
import { getLocalWarehouseSupply, withdrawWarehouseSupply } from '../src/warehouse-guidance.ts'
import { restoreFarm } from '../src/farm.ts'

test('exact repeat can return from its local warehouse without crafting or changing the recipe',()=>{
  const {farm,recipeId}=recipeWarehouseReturnFixture(), before=structuredClone(farm)
  const item={kind:'produce',item:'wheat',quantity:1} as const
  assert.equal(getRequirementHint(farm,{kind:'stock',item}).action.target,'warehouse-supply')
  const supply=getLocalWarehouseSupply(farm,item)!
  assert.deepEqual(farm,before)
  assert.ok(getRecipeRepeatGuide(farm,recipeId))
  assert.equal(withdrawWarehouseSupply(farm,item,supply).ok,true)
  const expected=structuredClone(before);expected.produce.wheat=1;expected.freight.warehouses.home.wheat=2
  assert.deepEqual(farm,expected)
  const loaded=restoreFarm(JSON.parse(JSON.stringify(farm)))!;assert.ok(loaded)
  assert.deepEqual(loaded.culinary,before.culinary)
  assert.equal(getRecipeRepeatGuide(loaded,recipeId)!.available,true)
  assert.equal(getRecipeRepeatGuide(loaded,recipeId)!.missing.length,0)
})
