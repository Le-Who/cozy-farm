import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFarm, restoreFarm } from '../src/farm.ts'
import { freightStock, addFreightStock } from '../src/bay-freight-model.ts'
import { createBayShop, stockBayShop, removeBayShopStock, setBayShopPrice } from '../src/bay-shop-model.ts'
import { shopQuantityPreview, placeShopQuantity } from '../src/bay-shop-quantity.ts'
import { reserveShopGoods, returnShopGoods, transferBayGoods, gardenMaterialStock, installGardenInstrument } from '../src/harbour-economy.ts'
import { getMusicMaterialGuidance } from '../src/music-material-guidance.ts'
import { isGuardedAction, ActivationKeyGuard, ActionClickGuard } from '../src/action-click-guard.ts'
import { neighborFoodFixture } from './fixtures/neighbor-food.ts'

const apple = {id:'apple',identity:'apple',name:'Яблоко',image:'/art/lavender/ui-apple.webp',basePrice:4,tags:['apple'],quantity:30}

test('stock preview is pure, exact, and uses an existing shelf price', () => {
  const state=createBayShop(); stockBayShop(state,0,apple,2); setBayShopPrice(state,0,7)
  const before=structuredClone(state)
  for(let i=0;i<10;i++)assert.deepEqual(shopQuantityPreview(state,0,apple,28),{maximum:30,valid:true,onShelf:2,remaining:2,after:30,price:7})
  assert.deepEqual(state,before)
  stockBayShop(state,0,apple,990)
  assert.equal(shopQuantityPreview(state,0,apple,8).valid,false)
  assert.equal(shopQuantityPreview(state,0,apple,7).maximum,7)
})

test('a batch takes warehouse first, exactly fills the shelf, and survives farm reload without earnings', () => {
  const {farm}=neighborFoodFixture(); farm.fruit.apple=20; addFreightStock(farm.freight,'village','apple',10)
  const before={coins:farm.coins,work:farm.workToday,rep:structuredClone(farm.bayShop.reputation)}
  assert.ok(placeShopQuantity(farm.bayShop,0,apple,28,(id,n)=>reserveShopGoods(farm,id,n)))
  assert.equal(farm.fruit.apple,2); assert.equal(freightStock(farm.freight,'village','apple'),0)
  assert.equal(farm.bayShop.slots[0]?.quantity,28)
  assert.deepEqual({coins:farm.coins,work:farm.workToday,rep:farm.bayShop.reputation},before)
  const restored=restoreFarm(JSON.parse(JSON.stringify(farm)))!; assert.ok(restored)
  assert.equal(restored.bayShop.slots[0]?.quantity,28);assert.equal(restored.fruit.apple,2)
  const returned=removeBayShopStock(restored.bayShop,0)!;returnShopGoods(restored,returned.id,returned.quantity)
  assert.equal(restored.fruit.apple,30);assert.equal(restored.bayShop.revenue,0)
})

test('invalid quantities or incompatible shelves never request stock or change state', () => {
  const state=createBayShop(); let calls=0
  for(const quantity of [0,-1,1.5,NaN,Infinity,31,1000])assert.equal(placeShopQuantity(state,0,apple,quantity,()=>{calls++;return true}),false)
  for(const index of [-1,.5,4,NaN])assert.equal(placeShopQuantity(state,index,apple,1,()=>{calls++;return true}),false)
  stockBayShop(state,0,{...apple,identity:'different'},1)
  const before=structuredClone(state)
  assert.equal(placeShopQuantity(state,0,apple,1,()=>{calls++;return true}),false)
  assert.equal(calls,0);assert.deepEqual(state,before)
})

test('stale availability, wrong island and unknown goods cannot partially reserve warehouse stock', () => {
  const {farm}=neighborFoodFixture();farm.fruit.apple=1;addFreightStock(farm.freight,'village','apple',2)
  let before=structuredClone(farm)
  assert.equal(placeShopQuantity(farm.bayShop,0,apple,28,(id,n)=>reserveShopGoods(farm,id,n)),false)
  assert.deepEqual(farm,before)
  farm.island='home';before=structuredClone(farm)
  assert.equal(placeShopQuantity(farm.bayShop,0,apple,1,(id,n)=>reserveShopGoods(farm,id,n)),false);assert.deepEqual(farm,before)
  farm.island='village';addFreightStock(farm.freight,'village','signature:removed',1);before=structuredClone(farm)
  assert.equal(reserveShopGoods(farm,'signature:removed',1),false);assert.deepEqual(farm,before)
})

test('a signature batch preserves exact identity, price and recipe without manufacturing portions', () => {
  const {farm,recipeId}=neighborFoodFixture();farm.culinary.stock[recipeId]=3
  const recipe=structuredClone(farm.culinary.recipes[0]),product={...apple,id:`signature:${recipeId}`,identity:`signature:${recipeId}`,quantity:3,signature:true}
  assert.ok(placeShopQuantity(farm.bayShop,1,product,2,(id,n)=>reserveShopGoods(farm,id,n)))
  assert.equal(farm.culinary.stock[recipeId],1);assert.deepEqual(farm.culinary.recipes[0],recipe)
  assert.equal(farm.bayShop.slots[1]?.product.identity,product.identity)
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))))
})

test('stock actions own a double click and held Enter, but a new keyboard press remains usable', () => {
  assert.ok(isGuardedAction('shop-stock-select'));assert.ok(isGuardedAction('shop-stock-confirm'))
  const pointer=new ActionClickGuard(), first={detail:1,timeStamp:100,clientX:10,clientY:20}
  pointer.remember(first);assert.ok(pointer.blocks({...first,timeStamp:130,detail:1}))
  assert.equal(pointer.blocks({...first,timeStamp:140,detail:0}),false)
  const key=new ActivationKeyGuard();assert.equal(key.blocks({key:'Enter',repeat:false},true),false)
  assert.ok(key.blocks({key:'Enter',repeat:true},false));key.release('Enter')
  assert.equal(key.blocks({key:'Enter',repeat:false},true),false)
})

test('music sources point to real shore and explain ready wax without mutating or inventing goods', () => {
  const farm=createFarm(), before=structuredClone(farm)
  const hints=getMusicMaterialGuidance(farm)
  assert.match(hints.sources.shells,/Солёная роща/);assert.doesNotMatch(hints.sources.shells,/Родной остров/)
  assert.match(hints.sources.beeswax,/после улучшения пасеки/);assert.deepEqual(farm,before)
  farm.musicGarden.level=1;farm.beeswax=1;addFreightStock(farm.freight,'village','beeswax',2);addFreightStock(farm.freight,'cape','beeswax',3)
  const current=getMusicMaterialGuidance(farm)
  assert.match(current.sources.beeswax,/Уже готово: в припасах 1, на складе гавани 2/)
  assert.match(current.sources.beeswax,/Цветочный мыс: 3/);assert.equal(current.warehouse,'cape')
  assert.equal(gardenMaterialStock(farm).beeswax,3)
  addFreightStock(farm.freight,'village','beeswax',1)
  assert.equal(getMusicMaterialGuidance(farm).warehouse,'village')
})

test('music ready counts match actual expansion consumption, and remote stock alone does not build', () => {
  const {farm}=neighborFoodFixture();farm.musicGarden.level=1;farm.shells.regular=8;addFreightStock(farm.freight,'cape','beeswax',4)
  const before=structuredClone(farm);assert.equal(installGardenInstrument(farm),undefined);assert.deepEqual(farm,before)
  farm.beeswax=2;addFreightStock(farm.freight,'village','beeswax',2)
  assert.equal(gardenMaterialStock(farm).beeswax,4);assert.equal(installGardenInstrument(farm),2)
  assert.equal(farm.beeswax,0);assert.equal(farm.shells.regular,0);assert.equal(freightStock(farm.freight,'village','beeswax'),0)
  assert.equal(freightStock(farm.freight,'cape','beeswax'),4)
})


test('ready warehouse wax travels into the bag without gathering and survives each reload', () => {
  const {farm}=neighborFoodFixture();farm.musicGarden.level=1;farm.shells.regular=8
  farm.capeLevel=2;farm.capeFlowers=[1,1,1];farm.capeHoneyOn=2
  addFreightStock(farm.freight,'cape','beeswax',4)
  const before=structuredClone(farm)
  getMusicMaterialGuidance(farm);assert.deepEqual(farm,before)
  assert.equal(transferBayGoods(farm,'withdraw','cape','beeswax',4).ok,false);assert.deepEqual(farm,before)
  farm.island='cape';assert.ok(transferBayGoods(farm,'withdraw','cape','beeswax',4).ok)
  assert.equal(farm.beeswax,4);assert.equal(farm.capeHoneyOn,2);assert.equal(farm.workToday,before.workToday)
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))))
  farm.island='village';assert.equal(installGardenInstrument(farm),2)
  assert.ok(restoreFarm(JSON.parse(JSON.stringify(farm))));assert.equal(farm.beeswax,0)
})

test('an inconsistent legacy wax warehouse cannot invalidate a farm by withdrawing before apiary unlock', () => {
  const {farm}=neighborFoodFixture();farm.island='cape';addFreightStock(farm.freight,'cape','beeswax',4)
  assert.ok(restoreFarm(farm));const before=structuredClone(farm)
  assert.equal(transferBayGoods(farm,'withdraw','cape','beeswax',4).ok,false);assert.deepEqual(farm,before)
  assert.ok(restoreFarm(farm))
})
