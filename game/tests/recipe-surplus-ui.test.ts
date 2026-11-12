import assert from 'node:assert/strict'
import { test } from 'node:test'
import { completeSignature, createFarm } from '../src/farm.ts'
import { RecipeSurplusSelection, renderRecipeSurplus } from '../src/recipe-surplus-ui.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'

function fixture() {
  const farm = createFarm()
  farm.buildingLevels.farmhouse = 2; farm.fruit.apple = 12; farm.produce.wheat = 8; farm.eggs = 5
  const made = completeSignature(farm, {base:'tart', ingredients:[{id:'apple',quantity:2}]}, {family:'decorate', fruit:[{ingredientId:'apple',x:0,y:0,angle:0}], steps:['fruit','dust']})
  assert.ok(made.ok)
  farm.culinary.recipes[0].name = 'Пирог & яблоки'
  return { farm, id: made.recipeId!, selection: new RecipeSurplusSelection() }
}
const label = (item: {kind:string,item?:string}) => `${item.kind}:${item.item ?? ''}`

test('choosing one or three repeats previews exact leftovers without selling or reserving', () => {
  const {farm,id,selection} = fixture(), before = structuredClone(farm)
  assert.match(renderRecipeSurplus(farm,selection,label), /Пирог &amp; яблоки/)
  assert.ok(selection.choose(farm,id,1))
  let html = renderRecipeSurplus(farm,selection,label)
  assert.match(html,/В запасе: 10 · нужно: 2/)
  assert.match(html,/Останется: 2 · продать: 8 за 32/)
  assert.ok(selection.choose(farm,id,3))
  html = renderRecipeSurplus(farm,selection,label)
  assert.match(html,/В запасе: 10 · нужно: 6/)
  assert.match(html,/Останется: 6 · продать: 4 за 16/)
  assert.match(html,/data-value="3" aria-pressed="true"/)
  assert.match(html,/Другие припасы, блюда и семена не затрагиваются/)
  assert.deepEqual(farm,before)
  selection.reset(); assert.equal(selection.quote,undefined); assert.deepEqual(farm,before)
})

test('a changed pantry requires a fresh review and old confirmation cannot sell it', () => {
  const {farm,id,selection} = fixture()
  selection.choose(farm,id,1); const token = selection.quote!.token
  farm.fruit.apple++
  const before = structuredClone(farm), html = renderRecipeSurplus(farm,selection,label)
  assert.match(html,/проверьте состав продажи заново/i)
  assert.doesNotMatch(html,/data-action="recipe-surplus-confirm"/)
  assert.equal(selection.confirm(farm,token).ok,false); assert.deepEqual(farm,before)
  assert.ok(selection.choose(farm,id,1))
  assert.equal(selection.confirm(farm,token).ok,false); assert.deepEqual(farm,before)
})

test('one confirmed sale shows a receipt and cannot repeat; missing stock is not advertised as ready', () => {
  const {farm,id,selection} = fixture(); farm.eggs = 0
  selection.choose(farm,id,3)
  const preview = renderRecipeSurplus(farm,selection,label), token = selection.quote!.token
  assert.match(preview,/Ещё не хватает: 3/)
  assert.match(preview,/Не всё собрано/)
  assert.ok(selection.confirm(farm,token).ok)
  const after = structuredClone(farm), receipt = renderRecipeSurplus(farm,selection,label)
  assert.match(receipt,/role="status"/); assert.match(receipt,/Не все ингредиенты собраны/)
  assert.doesNotMatch(receipt,/data-action="recipe-surplus-confirm"/)
  assert.equal(selection.confirm(farm,token).ok,false); assert.deepEqual(farm,after)
})

test('no surplus, absent recipe and away views do not expose an active sale', () => {
  const {farm,id,selection} = fixture(); farm.fruit.apple = 2; farm.produce.wheat = 1; farm.eggs = 1
  selection.choose(farm,id,1)
  assert.match(renderRecipeSurplus(farm,selection,label), /data-action="recipe-surplus-confirm"[^>]* disabled/)
  farm.island = 'grove'; assert.doesNotMatch(renderRecipeSurplus(farm,selection,label),/recipe-surplus-confirm/)
  farm.island = 'home'; farm.culinary.recipes = []
  assert.doesNotMatch(renderRecipeSurplus(farm,selection,label),/recipe-surplus-confirm/)
  for (const action of ['choose','quantity','refresh','reset','confirm','recipe']) assert.equal(isGuardedAction(`recipe-surplus-${action}`),true)
})
