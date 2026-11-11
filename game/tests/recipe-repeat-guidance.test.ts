import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { getRecipeRepeatGuide, renderRecipeRepeatGuide } from '../src/recipe-repeat-guidance.ts'
import { repeatSignature, restoreFarm, sail, unpackEggBasket, completeSignature, favoriteSignature, forgetSignature, createFarm } from '../src/farm.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'
import { recipeRepeatReturnFixture } from './fixtures/recipe-repeat-return.ts'

const stock = (item: {kind:string,item?:string,trait?:string,quantity:number}) => `<li>${item.kind}:${item.item??''}:${item.trait??''} ×${item.quantity}</li>`

test('the saved tart explains all exact ingredients, including wheat and the missing loose egg', () => {
  const {farm,recipeId}=recipeRepeatReturnFixture('missing')
  const guide=getRecipeRepeatGuide(farm,recipeId)!
  assert.deepEqual(guide.items,[{kind:'fruit',item:'apple',quantity:2},{kind:'produce',item:'wheat',quantity:1},{kind:'eggs',quantity:1}])
  assert.deepEqual(guide.missing,[{kind:'eggs',quantity:1}])
  assert.equal(guide.available,false)
  const html=renderRecipeRepeatGuide(farm,recipeId,stock,true)
  assert.match(html,/Для точного повтора ×1/)
  assert.match(html,/eggs:: ×1/)
  assert.match(html,/data-repeat-guide="s1" open/)
  assert.match(html,/втрое больше каждого ингредиента/)
})

test('looking at ingredients and reopening the book never unpacks or cooks automatically', () => {
  const {farm,recipeId}=recipeRepeatReturnFixture('missing'),before=structuredClone(farm)
  for(let i=0;i<4;i++)renderRecipeRepeatGuide(farm,recipeId,stock,i%2===0)
  assert.equal(repeatSignature(farm,recipeId).ok,false)
  assert.deepEqual(farm,before)
  assert.equal(unpackEggBasket(farm).ok,true)
  const afterUnpack=structuredClone(farm)
  assert.equal(getRecipeRepeatGuide(farm,recipeId)?.available,true)
  renderRecipeRepeatGuide(farm,recipeId,stock,true)
  assert.deepEqual(farm,afterUnpack)
  assert.equal(repeatSignature(farm,recipeId).recipeId,recipeId)
  assert.equal(farm.eggs,2)
  assert.equal(farm.fruit.apple,4)
  assert.equal(farm.produce.wheat,2)
  assert.equal(farm.culinary.stock[recipeId],1)
  assert.equal(farm.culinary.serial,1)
})

test('the same recipe survives reload and explicit home travel without spending or crafting', () => {
  const fixture=recipeRepeatReturnFixture('away')
  const farm=restoreFarm(JSON.parse(JSON.stringify(fixture.farm)))!
  const before=structuredClone(farm),guide=getRecipeRepeatGuide(farm,fixture.recipeId)!
  assert.equal(guide.away,true)
  assert.equal(guide.available,false)
  assert.deepEqual(guide.missing,[])
  assert.match(renderRecipeRepeatGuide(farm,fixture.recipeId,stock),/На домашнюю кухню/)
  assert.equal(sail(farm,'home').ok,true)
  assert.deepEqual(farm,{...before,island:'home'})
  assert.equal(getRecipeRepeatGuide(farm,fixture.recipeId)?.available,true)
  const saved=structuredClone(farm.culinary.recipes[0])
  assert.equal(repeatSignature(farm,fixture.recipeId).recipeId,fixture.recipeId)
  assert.deepEqual(farm.culinary.recipes[0],{...saved,batches:saved.batches+1})
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))))
})

test('a kitchen in the built village remains valid and does not force a home journey', () => {
  const {farm,recipeId}=recipeRepeatReturnFixture('ready')
  farm.island='village'
  const guide=getRecipeRepeatGuide(farm,recipeId)!
  assert.equal(guide.away,false)
  assert.equal(guide.available,true)
  assert.doesNotMatch(renderRecipeRepeatGuide(farm,recipeId,stock),/recipe-repeat-home/)
})

test('special fruit remains an exact requirement and ordinary fruit cannot silently replace it', () => {
  const farm=createFarm();farm.buildingLevels.farmhouse=2;farm.variants.apple={rainbow:4};farm.fruit.apple=50
  const made=completeSignature(farm,{base:'preserves',ingredients:[{id:'apple',quantity:2,trait:'rainbow'}]}, {family:'preserves',processing:'silky',fruit:[],steps:['stir','pour']})
  assert.equal(made.ok,true)
  farm.variants.apple!.rainbow=0
  const guide=getRecipeRepeatGuide(farm,made.recipeId!)!
  assert.deepEqual(guide.missing,[{kind:'variants',item:'apple',trait:'rainbow',quantity:2}])
  assert.match(renderRecipeRepeatGuide(farm,made.recipeId!,stock),/variants:apple:rainbow ×2/)
  const before=structuredClone(farm)
  assert.equal(repeatSignature(farm,made.recipeId!).ok,false)
  assert.deepEqual(farm,before)
})

test('stale or removed recipe IDs cannot show another recipe or become a new draft', () => {
  const {farm,recipeId}=recipeRepeatReturnFixture('ready')
  assert.equal(favoriteSignature(farm,recipeId,false).ok,true)
  assert.equal(forgetSignature(farm,recipeId).ok,true)
  const before=structuredClone(farm)
  assert.equal(getRecipeRepeatGuide(farm,recipeId),undefined)
  assert.equal(renderRecipeRepeatGuide(farm,recipeId,stock),'')
  assert.equal(repeatSignature(farm,recipeId).ok,false)
  assert.deepEqual(farm,before)
})

test('book integration keeps exact repeat, guards travel, and restores the disclosure with Back', () => {
  const ui=readFileSync(new URL('../src/culinary-ui.ts',import.meta.url),'utf8')
  const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
  assert.match(ui,/renderRecipeRepeatGuide\(farm,recipe.id,art.stock,expandedRepeatId===recipe.id\)/)
  assert.match(main,/expandedRepeatId=previous.expandedRepeatId/)
  const handler=main.slice(main.indexOf("case 'recipe-repeat-home':"),main.indexOf("case 'make-signature':"))
  assert.match(handler,/if\(!recipe\)break/)
  assert.match(handler,/visitPanelAt\('home','recipes'\)/)
  assert.doesNotMatch(handler,/repeatSignature|completeSignature|endDay/)
  assert.equal(isGuardedAction('recipe-repeat-home'),true)
})
