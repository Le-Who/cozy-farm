import assert from 'node:assert/strict'
import test from 'node:test'
import { earnedRecipeBookPlayer } from './fixtures/earned-recipe-book.ts'
import { getSignatureAction } from '../src/farm.ts'
import { getRequirementHint, type Requirement } from '../src/requirement-guidance.ts'

test('an exact saved repeat can pick its ripe local ingredient without losing the recipe', () => {
  const p=earnedRecipeBookPlayer(), recipe=p.state.culinary.recipes.find(r=>r.id==='s4')!
  const apples:Requirement={kind:'stock',item:{kind:'fruit',item:'apple',quantity:2}}
  // Three authored recipes share the name; matching a title or scanning for a different recipe is incorrect.
  assert.equal(p.state.culinary.recipes.filter(r=>r.name===recipe.name).length,3)
  assert.equal(getSignatureAction(p.state,recipe).available,false)
  assert.equal(getRequirementHint(p.state,apples).action.target,'visit-tree')
  const before=structuredClone(p.state), route=getRequirementHint(p.state,apples,'saved-recipe')
  assert.deepEqual(p.state,before)
  assert.equal(route.action.target,'inspect-tree');assert.equal(route.selector,'[data-action="pick-fruit"]')
  const slot=Number(route.action.value)
  assert.equal(p.state.trees.home[slot]?.tree,'apple')
  p.act('pickFruit',slot)
  assert.equal(p.state.fruit.apple,2);assert.deepEqual(p.state.culinary,before.culinary)
  assert.ok(getSignatureAction(p.state,recipe).available)
  assert.notEqual(getRequirementHint(p.state,apples,'saved-recipe').action.target,'inspect-tree')
  p.act('repeatSignature',recipe.id)
  assert.equal(p.state.fruit.apple,0)
  assert.equal(p.state.culinary.stock.s4,before.culinary.stock.s4+1)
  assert.equal(p.state.culinary.stock.s1,before.culinary.stock.s1)

  assert.notEqual(getRequirementHint(p.state,apples,'saved-recipe').action.target,'inspect-tree','empty tree')
  p.night();p.act('pickFruit',slot);p.act('transferBayGoods','deposit','home','apple',p.state.fruit.apple)
  p.night()
  assert.equal(getRequirementHint(p.state,apples,'saved-recipe').action.target,'warehouse-supply','stored local fruit still takes priority over harvesting')
})
