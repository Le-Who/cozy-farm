import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'
import { createFarm, completeSignature } from '../src/farm.ts'

function bookFarm() {
  const farm = createFarm()
  farm.buildingLevels.farmhouse = 2
  farm.fruit.apple = 20; farm.produce.wheat = 10; farm.eggs = 10
  const first = completeSignature(farm, {base:'tart', ingredients:[{id:'apple', quantity:2}]}, {family:'decorate', fruit:[{ingredientId:'apple',x:0,y:0,angle:0}], steps:['fruit']}).recipeId!
  const second = completeSignature(farm, {base:'tart', ingredients:[{id:'apple', quantity:2}]}, {family:'decorate', fruit:[{ingredientId:'apple',x:.2,y:0,angle:0}], steps:['fruit']}).recipeId!
  return {farm, first, second}
}
const art = {icon:()=>'<img alt="">', stock:(item:{kind:string;quantity:number})=>`<li>${item.kind} ×${item.quantity}</li>`}

test('book indexes every recipe but exposes actions for only the explicitly selected recipe without spending', async () => {
  const server = await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'})
  try {
    const {signatureBook} = await server.ssrLoadModule('/src/culinary-ui.ts')
    const {farm,first,second} = bookFarm(), before = structuredClone(farm)
    const html = signatureBook(farm,art,{selectedId:first,mode:'detail'})
    assert.equal((html.match(/data-action="select-recipe"/g)??[]).length,2)
    assert.match(html,new RegExp(`data-action="make-signature" data-value="${first}"`))
    assert.doesNotMatch(html,new RegExp(`data-action="make-signature" data-value="${second}"`))
    assert.deepEqual(farm,before)
  } finally {await server.close()}
})

test('carried portions, warehouse recovery, missing supplies and active picnic stay independent', async () => {
  const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'})
  try {
    const {signatureBook}=await server.ssrLoadModule('/src/culinary-ui.ts')
    const {storedRecipesFixture}=await import('./fixtures/stored-recipes.ts')
    const {farm,recipeId}=storedRecipesFixture(); farm.culinary.stock[recipeId]=0
    const before=structuredClone(farm),html=signatureBook(farm,art,{selectedId:recipeId,mode:'detail'})
    assert.match(html,/<dt>С собой<\/dt><dd>0<\/dd>/)
    assert.match(html,/<dt>На местном складе<\/dt><dd>3<\/dd>/)
    assert.match(html,/data-action="recipe-warehouse-withdraw" data-value="home\|s1\|3"/)
    assert.match(html,/Не хватает 1 яйца/)
    assert.match(html,/data-action="make-signature"[^>]*disabled/)
    assert.match(html,/data-action="use-signature"[^>]*disabled/)
    assert.match(html,/data-action="sell-signature"[^>]*disabled/)
    assert.doesNotMatch(html,/Пикник действует · до сна/)
    assert.deepEqual(farm,before)
    farm.culinary.stock[recipeId]=2;farm.culinary.picnic={day:farm.day,processing:'silky'}
    const active=signatureBook(farm,art,{selectedId:recipeId,mode:'detail'})
    assert.match(active,/data-recipe-disclosure="picnic-status"/)
    assert.match(active,/data-action="use-signature"[^>]*disabled/)
    assert.match(active,/Ручная выпечка в мастерской этот эффект не расходует/)
    assert.match(active,/Эффект действует только сегодня и исчезнет после сна/)
    assert.match(active,/data-action="sell-signature"[^>]* >Продать…/)
  } finally {await server.close()}
})

test('selection survives favorite sorting, rejects stale IDs and falls back safely after deletion', async () => {
  const {RecipeBookNavigation}=await import('../src/recipe-book-view.ts')
  const {farm,first,second}=bookFarm(),nav=new RecipeBookNavigation(),before=structuredClone(farm)
  nav.reconcile(farm);assert.equal(nav.view.mode,'index')
  assert.equal(nav.select(farm,first,true),true)
  nav.view.indexScroll=120;nav.view.detailScroll=64;nav.view.disclosures=['picnic-offer']
  assert.equal(nav.select(farm,'missing'),false);assert.equal(nav.view.selectedId,first)
  assert.deepEqual(farm,before)
  farm.culinary.recipes.find(recipe=>recipe.id===second)!.favorite=true
  nav.reconcile(farm);assert.equal(nav.view.selectedId,first);assert.equal(nav.view.detailScroll,64)
  const snapshot=structuredClone(nav.view)
  nav.select(farm,second);assert.equal(nav.view.detailScroll,0)
  nav.load(snapshot);snapshot.disclosures!.push('other')
  assert.deepEqual(nav.view.disclosures,['picnic-offer'])
  farm.culinary.recipes=farm.culinary.recipes.filter(recipe=>recipe.id!==first)
  nav.reconcile(farm);assert.equal(nav.view.selectedId,second);assert.equal(nav.view.mode,'index');assert.equal(nav.view.focus,undefined)
})
