import assert from 'node:assert/strict'
import { test } from 'node:test'
import { completeSignature, finishNeighborPlan, restoreFarm, serveNeighborPlan, type NeighborAssembly } from '../src/farm.ts'
import { getNeighborFoodRecovery, repeatNeighborFood, repeatRequestedSignature } from '../src/neighbor-food-recovery.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'
import { neighborFoodFixture } from './fixtures/neighbor-food.ts'
const load = (farm: ReturnType<typeof neighborFoodFixture>['farm']) => restoreFarm(JSON.parse(JSON.stringify(farm)))!
const assembly: NeighborAssembly = {kind:'table',settled:true,placements:[{slot:'food',x:0,y:0},{slot:'cup',x:-.6,y:.3},{slot:'flowers',x:.6,y:.3}]}

test('spent selection remains arranging with the same id, name and history after inspection and reload', () => {
  const {farm,planId}=neighborFoodFixture(),before=structuredClone(farm)
  for(let i=0;i<3;i++){const recovery=getNeighborFoodRecovery(farm,planId)!;assert.equal(recovery.state,'spent');assert.match(recovery.message,/прогресс сохранены/)}
  assert.deepEqual(farm,before);assert.equal(getNeighborFoodRecovery(load(farm),planId)?.state,'spent')
  assert.equal(finishNeighborPlan(farm,planId,assembly).ok,false);assert.deepEqual(farm,before)
})

test('exact recovery repeats the saved identity, layout and processing once without changing the meeting', () => {
  const {farm,planId,recipeId}=neighborFoodFixture(),before=structuredClone(farm),recipe=structuredClone(farm.culinary.recipes[0])
  assert.ok(repeatNeighborFood(farm,planId).ok)
  assert.equal(farm.culinary.stock[recipeId],1);assert.equal(farm.culinary.serial,before.culinary.serial)
  assert.deepEqual(farm.culinary.recipes[0],{...recipe,batches:recipe.batches+1})
  assert.deepEqual(farm.neighbors,before.neighbors);assert.deepEqual(farm.village,before.village);assert.equal(farm.coins,before.coins)
  assert.equal(farm.fruit.apple,before.fruit.apple-2);assert.equal(farm.produce.wheat,before.produce.wheat-1);assert.equal(farm.eggs,before.eggs-1)
  assert.equal(getNeighborFoodRecovery(farm,planId)?.state,'ready')
  const repeated=structuredClone(farm);assert.equal(repeatNeighborFood(farm,planId).ok,false);assert.deepEqual(farm,repeated)
  const restored=load(farm);assert.ok(restored);assert.equal(getNeighborFoodRecovery(restored,planId)?.state,'ready')
  assert.ok(finishNeighborPlan(restored,planId,assembly).ok);assert.equal(restored.culinary.stock[recipeId],0);assert.equal(restored.neighbors.bea.completed,1)
  const finished=structuredClone(restored);assert.equal(finishNeighborPlan(restored,planId,assembly).ok,false);assert.deepEqual(restored,finished)
})

test('a deleted recipe is not recreated and replacement preserves meeting serial and start day', () => {
  const {farm,planId,recipeId}=neighborFoodFixture(true),before=structuredClone(farm)
  const recovery=getNeighborFoodRecovery(farm,planId)!;assert.equal(recovery.state,'deleted');assert.equal(recovery.offer,undefined);assert.match(recovery.message,/рецепт удалён/)
  assert.equal(repeatNeighborFood(farm,planId).ok,false);assert.deepEqual(farm,before)
  const restored=load(farm);assert.ok(restored);assert.equal(getNeighborFoodRecovery(restored,planId)?.state,'deleted')
  assert.ok(serveNeighborPlan(restored,planId,'dish:strawberryTart').ok)
  assert.equal(restored.neighbors.bea.current?.serial,before.neighbors.bea.current?.serial)
  assert.equal(restored.neighbors.bea.current?.startedOn,before.neighbors.bea.current?.startedOn)
  assert.equal(restored.neighbors.bea.current?.phase,'arranging');assert.deepEqual(restored.neighbors.bea.memories,before.neighbors.bea.memories)
  assert.equal(restored.dishes.strawberryTart,2,'choice does not consume the replacement')
  assert.ok(finishNeighborPlan(restored,planId,assembly).ok);assert.equal(restored.dishes.strawberryTart,1)
  assert.equal(restored.neighbors.bea.completed,1);assert.equal(restored.culinary.recipes.some(recipe=>recipe.id===recipeId),false)
  assert.ok(load(restored))
})

test('missing ingredients, wrong island and stale meeting fail without resetting progress or spending', () => {
  for(const blocked of ['ingredient','island','stale'] as const) {
    const {farm,planId}=neighborFoodFixture();if(blocked==='ingredient')farm.fruit.apple=0;if(blocked==='island')farm.island='grove'
    const before=structuredClone(farm)
    assert.equal(repeatNeighborFood(farm,blocked==='stale'?'bea:999':planId).ok,false);assert.deepEqual(farm,before)
  }
})

test('full book still recovers exactly the selected recipe without adding an entry', () => {
  const {farm,planId,recipeId}=neighborFoodFixture()
  for(let i=1;i<24;i++)assert.ok(completeSignature(farm,{base:'tart',ingredients:[{id:'apple',quantity:2}]},{family:'decorate',processing:'chunky',fruit:[{ingredientId:'apple',x:.2,y:-.3,angle:.4+i*.1}],steps:['fruit','bake'],baking:{method:'oven',finish:'golden',seconds:90}}).ok)
  assert.equal(farm.culinary.recipes.length,24);const others=structuredClone(farm.culinary.recipes.slice(1)),serial=farm.culinary.serial
  assert.ok(repeatNeighborFood(farm,planId).ok);assert.equal(farm.culinary.stock[recipeId],1);assert.equal(farm.culinary.serial,serial);assert.deepEqual(farm.culinary.recipes.slice(1),others)
  assert.ok(load(farm))
})

test('ordinary missing dishes retain their recipe route and an ineligible replacement does not alter the choice', () => {
  const {farm,planId}=neighborFoodFixture()
  assert.ok(serveNeighborPlan(farm,planId,'dish:strawberryTart').ok);farm.dishes.strawberryTart=0
  const before=structuredClone(farm),recovery=getNeighborFoodRecovery(farm,planId)!
  assert.equal(recovery.state,'spent');assert.equal(recovery.offer?.source,'dish')
  assert.equal(repeatNeighborFood(farm,planId).ok,false);assert.deepEqual(farm,before)
  assert.equal(serveNeighborPlan(farm,planId,'handmade:round').ok,false);assert.deepEqual(farm,before)
})

test('recipe recovery guards reject wrong or already available food, and gestures include the new controls', () => {
  const {farm,recipeId}=neighborFoodFixture()
  const before=structuredClone(farm)
  assert.equal(repeatRequestedSignature(farm,'hearty',`signature:${recipeId}`).ok,false)
  assert.equal(repeatRequestedSignature(farm,'delicate','signature:s999').ok,false);assert.deepEqual(farm,before)
  assert.ok(repeatRequestedSignature(farm,'delicate',`signature:${recipeId}`).ok)
  const made=structuredClone(farm);assert.equal(repeatRequestedSignature(farm,'delicate',`signature:${recipeId}`).ok,false);assert.deepEqual(farm,made)
  for(const action of ['neighbor-repeat-food','request-repeat-exact','choose-neighbor-food'])assert.ok(isGuardedAction(action))
})

test('a prepared local recipe is found for the saved meeting without cooking or taking it', async () => {
  const {repeatSignature}=await import('../src/farm.ts')
  const {transferBayGoods}=await import('../src/harbour-economy.ts')
  const {farm,planId,recipeId}=neighborFoodFixture()
  assert.ok(repeatSignature(farm,recipeId,undefined,3).ok)
  assert.ok(transferBayGoods(farm,'deposit','village',`signature:${recipeId}`,3).ok)
  const before=structuredClone(farm),recovery=getNeighborFoodRecovery(farm,planId)!
  assert.deepEqual(recovery.warehouse,{kind:'signature',port:'village',recipeId,stored:3})
  assert.equal(recovery.state,'spent','warehouse stock is not carried food')
  assert.match(recovery.message,/на местном складе: 3/)
  assert.doesNotMatch(recovery.message,/Приготовьте ещё/)
  assert.deepEqual(farm,before)
  assert.deepEqual(getNeighborFoodRecovery(load(farm),planId)?.warehouse,recovery.warehouse)
})
