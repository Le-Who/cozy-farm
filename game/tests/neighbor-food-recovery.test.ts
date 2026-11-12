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

test('ordinary selected food resolves its exact local warehouse request, not raw ingredients', async () => {
  const {transferBayGoods}=await import('../src/harbour-economy.ts')
  const {farm,planId}=neighborFoodFixture()
  assert.ok(serveNeighborPlan(farm,planId,'dish:strawberryTart').ok)
  assert.ok(transferBayGoods(farm,'deposit','village','dish:strawberryTart',2).ok)
  const before=structuredClone(farm),recovery=getNeighborFoodRecovery(farm,planId)!
  assert.equal(recovery.warehouse?.kind,'stock')
  assert.deepEqual(recovery.warehouse?.request,{kind:'dishes',item:'strawberryTart',quantity:1})
  assert.equal(recovery.warehouse?.stored,2)
  assert.equal(recovery.warehouse?.quantity,1)
  assert.equal(recovery.warehouse?.id,'dish:strawberryTart')
  assert.equal(recovery.state,'spent')
  assert.deepEqual(farm,before)
  assert.deepEqual(getNeighborFoodRecovery(load(farm),planId)?.warehouse,recovery.warehouse)
})

test('a stale repeat command cannot cook a new batch while the exact selected portion is locally stored', async () => {
  const {repeatSignature}=await import('../src/farm.ts')
  const {transferBayGoods}=await import('../src/harbour-economy.ts')
  const {farm,planId,recipeId}=neighborFoodFixture()
  assert.ok(repeatSignature(farm,recipeId,undefined,1).ok)
  assert.ok(transferBayGoods(farm,'deposit','village',`signature:${recipeId}`,1).ok)
  const before=structuredClone(farm)
  assert.equal(repeatNeighborFood(farm,planId).ok,false)
  assert.deepEqual(farm,before)
})

test('existing withdrawals recover one exact portion and only the later meeting spends it', async () => {
  const {repeatSignature,bakeWorkshop,getNeighborPlans,joinNeighborPlan}=await import('../src/farm.ts')
  const {transferBayGoods}=await import('../src/harbour-economy.ts')
  const {withdrawStoredSignature,storedSignatureValue}=await import('../src/stored-signature.ts')
  const {withdrawWarehouseSupply,warehouseConfirmation,warehouseConfirmationValue}=await import('../src/warehouse-guidance.ts')
  for(const kind of ['signature','dish','handmade']) {
    const {farm,planId,recipeId}=neighborFoodFixture()
    let target=planId,id=`signature:${recipeId}`,quantity=3
    if(kind==='signature')assert.ok(repeatSignature(farm,recipeId,undefined,3).ok)
    if(kind==='dish') {id='dish:strawberryTart';quantity=2;assert.ok(serveNeighborPlan(farm,planId,'dish:strawberryTart').ok)}
    if(kind==='handmade') {
      assert.ok(bakeWorkshop(farm,'round').ok)
      target=getNeighborPlans(farm).find(plan=>plan.resident==='finn')!.id
      assert.ok(joinNeighborPlan(farm,target).ok)
      assert.ok(serveNeighborPlan(farm,target,'handmade:round').ok)
      id='handmade:round';quantity=farm.handmade.round
    }
    assert.ok(transferBayGoods(farm,'deposit','village',id,quantity).ok)
    const before=structuredClone(farm),supply=getNeighborFoodRecovery(farm,target)!.warehouse!
    assert.ok(supply)
    assert.equal(finishNeighborPlan(farm,target,kind==='handmade'?{...assembly,kind:'basket'}:assembly).ok,false)
    assert.deepEqual(farm,before)
    const confirmation=supply.kind==='signature'?storedSignatureValue(supply):warehouseConfirmationValue(supply)
    const withdraw=()=>supply.kind==='signature'?withdrawStoredSignature(farm,confirmation)
      :withdrawWarehouseSupply(farm,supply.request,warehouseConfirmation(confirmation))
    assert.equal(withdraw().ok,true)
    const expected=structuredClone(before)
    if(quantity===1)delete expected.freight.warehouses.village[id];else expected.freight.warehouses.village[id]=quantity-1
    if(kind==='signature')expected.culinary.stock[recipeId]=1
    if(kind==='dish')expected.dishes.strawberryTart=1
    if(kind==='handmade')expected.handmade.round=1
    assert.deepEqual(farm,expected,'withdrawal changes only exact bag and local stock')
    assert.equal(withdraw().ok,false,'same confirmation cannot transfer again')
    assert.deepEqual(farm,expected)
    const loaded=load(farm)
    assert.equal(getNeighborFoodRecovery(loaded,target)?.state,'ready')
    assert.equal(getNeighborFoodRecovery(loaded,target)?.warehouse,undefined)
    assert.ok(finishNeighborPlan(loaded,target,kind==='handmade'?{...assembly,kind:'basket'}:assembly).ok)
    assert.equal(loaded.neighbors[kind==='handmade'?'finn':'bea'].completed,1)
    const finished=structuredClone(loaded)
    assert.equal(finishNeighborPlan(loaded,target,kind==='handmade'?{...assembly,kind:'basket'}:assembly).ok,false)
    assert.deepEqual(loaded,finished);assert.ok(load(loaded))
  }
})

test('remote, inaccessible, stale and unwithdrawable supplies never offer a local recovery', async () => {
  const {repeatSignature}=await import('../src/farm.ts')
  const {transferBayGoods}=await import('../src/harbour-economy.ts')
  for(const reason of ['remote','empty','locked','ready','deleted','changed-food','stale-plan','invalid-save']) {
    const {farm,planId,recipeId}=neighborFoodFixture()
    assert.ok(repeatSignature(farm,recipeId,undefined,1).ok)
    assert.ok(transferBayGoods(farm,'deposit','village',`signature:${recipeId}`,1).ok)
    if(reason==='remote')farm.island='home'
    if(reason==='empty')farm.freight.warehouses.village={}
    if(reason==='locked')farm.boatOwned=false
    if(reason==='ready')assert.ok(repeatSignature(farm,recipeId,undefined,1).ok)
    if(reason==='deleted')farm.culinary.recipes=[]
    if(reason==='changed-food')assert.ok(serveNeighborPlan(farm,planId,'dish:strawberryTart').ok)
    if(reason==='invalid-save')farm.culinary.recipes[0].batches=0
    const before=structuredClone(farm)
    assert.equal(getNeighborFoodRecovery(farm,reason==='stale-plan'?'bea:999':planId)?.warehouse,undefined,reason)
    assert.deepEqual(farm,before,reason)
  }
})

test('a valid local portion takes priority over a selling shelf and the new route owns its gesture', async () => {
  const {repeatSignature,foodDescriptors}=await import('../src/farm.ts')
  const {transferBayGoods,reserveShopGoods}=await import('../src/harbour-economy.ts')
  const {stockBayShop}=await import('../src/bay-shop-model.ts')
  const {describeFood}=await import('../src/intent-orders.ts')
  const {farm,planId,recipeId}=neighborFoodFixture(),id=`signature:${recipeId}`
  assert.ok(repeatSignature(farm,recipeId,undefined,3).ok)
  assert.ok(transferBayGoods(farm,'deposit','village',id,1).ok)
  const food=foodDescriptors(farm).find(food=>food.id===id)!
  assert.ok(reserveShopGoods(farm,id,2))
  assert.ok(stockBayShop(farm.bayShop,0,{id,identity:id,name:food.name,image:'/art/lavender/ui-tart.webp',basePrice:food.sellPrice,tags:[...food.ingredients,...describeFood(food)]},2))
  // reserveShopGoods uses the local warehouse first; move the remaining carried portion there.
  assert.ok(transferBayGoods(farm,'deposit','village',id,1).ok)
  const before=structuredClone(farm),recovery=getNeighborFoodRecovery(farm,planId)!
  assert.equal(recovery.warehouse?.stored,1);assert.equal(recovery.shelved,2)
  assert.match(recovery.message,/на местном складе: 1/);assert.doesNotMatch(recovery.message,/на прилавке/)
  assert.deepEqual(farm,before);assert.ok(load(farm))
  assert.ok(isGuardedAction('neighbor-stored-food'))
})
