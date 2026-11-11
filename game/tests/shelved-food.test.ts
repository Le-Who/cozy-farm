import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'
import {createServer} from 'vite'
import {getNeighborFoodRecovery} from '../src/neighbor-food-recovery.ts'
import {foodDescriptors,restoreFarm,serveNeighborPlan,finishNeighborPlan,type NeighborAssembly} from '../src/farm.ts'
import {describeFood} from '../src/intent-orders.ts'
import {reserveShopGoods,returnShopGoods} from '../src/harbour-economy.ts'
import {advanceBayShop,removeBayShopStock,setBayShopOpen,stockBayShop} from '../src/bay-shop-model.ts'
import {isGuardedAction,ActionClickGuard,ActivationKeyGuard} from '../src/action-click-guard.ts'
import {shelvedFoodFixture} from './fixtures/shelved-food.ts'

const reload=(farm:ReturnType<typeof shelvedFoodFixture>['farm'])=>restoreFarm(JSON.parse(JSON.stringify(farm)))!
const assembly:NeighborAssembly={kind:'table',settled:true,placements:[{slot:'food',x:0,y:0},{slot:'cup',x:-.6,y:.3},{slot:'flowers',x:.6,y:.3}]}
function prepared(ordinary=false){
  const {farm,recipeId}=shelvedFoodFixture(),id=ordinary?'dish:strawberryTart' as const:`signature:${recipeId}` as const
  if(ordinary)assert.equal(serveNeighborPlan(farm,'bea:1',id).ok,true)
  const food=foodDescriptors(farm).find(food=>food.id===id)!
  const product={id,identity:id,name:food.name,image:'/art/lavender/ui-tart.webp',basePrice:food.sellPrice,tags:[...food.ingredients,...describeFood(food)]}
  assert.equal(reserveShopGoods(farm,id,food.count),true);assert.equal(stockBayShop(farm.bayShop,2,product,food.count),true)
  assert.ok(reload(farm));return {farm,recipeId,id,product}
}

test('the meeting finds the exact selected food on the shelf without spending, opening the shop or changing progress',()=>{
  const {farm}=prepared(),before=structuredClone(farm)
  for(let i=0;i<3;i++){
    const guide=getNeighborFoodRecovery(farm,'bea:1')!
    assert.equal(guide.shelved,3);assert.match(guide.message,/на прилавке вашей лавки: 3/)
    assert.match(guide.message,/Лавка закрыта/);assert.doesNotMatch(guide.message,/закончилось|Приготовьте ещё/)
  }
  assert.deepEqual(farm,before);assert.deepEqual(getNeighborFoodRecovery(reload(farm),'bea:1'),getNeighborFoodRecovery(farm,'bea:1'))
  assert.equal(finishNeighborPlan(farm,'bea:1',assembly).ok,false);assert.deepEqual(farm,before)
})

test('an open shop is described honestly, and a real sale updates the count without changing the meeting',()=>{
  const {farm}=prepared(),meeting=structuredClone(farm.neighbors)
  setBayShopOpen(farm.bayShop,true)
  assert.match(getNeighborFoodRecovery(farm,'bea:1')!.message,/Лавка открыта: покупатели могут забрать/)
  const before=structuredClone(farm);getNeighborFoodRecovery(farm,'bea:1');assert.deepEqual(farm,before)
  for(let tick=0;tick<1000&&farm.bayShop.slots[2]!.quantity>0;tick++)for(const sale of advanceBayShop(farm.bayShop,1000))farm.coins+=sale.price
  assert.equal(farm.bayShop.slots[2]!.quantity,0);assert.deepEqual(farm.neighbors,meeting)
  const loaded=reload(farm);assert.ok(loaded)
  assert.equal(getNeighborFoodRecovery(loaded,'bea:1')!.shelved,0)
  assert.match(getNeighborFoodRecovery(loaded,'bea:1')!.message,/угощение закончилось/)
})

test('only a separate existing shelf return makes the meal ready; finishing still consumes and rewards once',()=>{
  const {farm,recipeId}=prepared(),before=structuredClone(farm),returned=removeBayShopStock(farm.bayShop,2)!
  returnShopGoods(farm,returned.id,returned.quantity)
  const expected=structuredClone(before);expected.bayShop.slots[2]=null;expected.culinary.stock[recipeId]=3
  assert.deepEqual(farm,expected)
  const loaded=reload(farm);assert.equal(getNeighborFoodRecovery(loaded,'bea:1')!.state,'ready')
  assert.equal(getNeighborFoodRecovery(loaded,'bea:1')!.shelved,0)
  assert.equal(finishNeighborPlan(loaded,'bea:1',assembly).ok,true);assert.equal(loaded.culinary.stock[recipeId],2)
  assert.equal(loaded.neighbors.bea.completed,1);const completed=structuredClone(loaded)
  assert.equal(finishNeighborPlan(loaded,'bea:1',assembly).ok,false);assert.deepEqual(loaded,completed);assert.ok(reload(loaded))
})

test('ordinary dishes use the same exact shelf ID, while different IDs and ready bag portions do not claim a recovery',()=>{
  const {farm,id}=prepared(true)
  assert.equal(id,'dish:strawberryTart');assert.equal(getNeighborFoodRecovery(farm,'bea:1')!.shelved,2)
  farm.bayShop.slots[2]!.product.id='dish:blueberryTart'
  assert.equal(getNeighborFoodRecovery(farm,'bea:1')!.shelved,0)
  farm.bayShop.slots[2]!.product.id=id;farm.dishes.strawberryTart=1
  assert.equal(getNeighborFoodRecovery(farm,'bea:1')!.state,'ready');assert.equal(getNeighborFoodRecovery(farm,'bea:1')!.shelved,0)
})

test('multiple matching shelves are counted, but changed, deleted and stale selections get no false route',()=>{
  const {farm,product}=prepared();farm.bayShop.slots[0]={product,quantity:1,price:product.basePrice}
  assert.equal(getNeighborFoodRecovery(farm,'bea:1')!.shelved,4)
  assert.equal(getNeighborFoodRecovery(farm,'bea:999'),undefined)
  assert.equal(serveNeighborPlan(farm,'bea:1','dish:strawberryTart').ok,true)
  assert.equal(getNeighborFoodRecovery(farm,'bea:1')!.shelved,0)
  const other=prepared().farm;other.culinary.recipes=[]
  assert.equal(getNeighborFoodRecovery(other,'bea:1')!.state,'deleted');assert.equal(getNeighborFoodRecovery(other,'bea:1')!.shelved,0)
})

const source=ts.createSourceFile('main.ts',readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true)
let clause:ts.CaseClause|undefined
const visit=(node:ts.Node)=>{if(ts.isCaseClause(node)&&node.expression.getText(source)==="'neighbor-shelf-food'")clause=node;ts.forEachChild(node,visit)}
visit(source);assert.ok(clause)
const js=ts.transpileModule(`(async()=>{switch('neighbor-shelf-food'){${clause.getText(source)}}})()`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
function handler(farm:ReturnType<typeof prepared>['farm'],food='signature:s1'){
  const destinations:string[]=[],redraws:string[]=[]
  const state={farm,dialog:{open:true},panel:'neighbor',communityResident:'bea',value:'bea:1',control:{dataset:{food}},communityRequest:undefined as unknown,requestedFood:undefined as unknown,
    getNeighborFoodRecovery,drawPanel:()=>redraws.push('draw'),visitPanelAt:async(island:string,panel:string)=>{destinations.push(`${island}/${panel}`)}}
  return {state,destinations,redraws,run:()=>runInNewContext(js,state) as Promise<void>}
}

test('the actual navigation handler only opens the existing shop and preserves food, shelves, shop status and meeting',async()=>{
  for(const open of [false,true]){
    const {farm,id}=prepared();setBayShopOpen(farm.bayShop,open);const before=structuredClone(farm),h=handler(farm,id)
    h.state.requestedFood=id
    await h.run();assert.deepEqual(h.destinations,['village/bay-shop']);assert.deepEqual(farm,before)
    assert.equal(h.state.requestedFood,undefined,'reload must return to the meeting rather than a new cooking route');assert.equal(JSON.stringify(h.state.communityRequest),JSON.stringify({kind:'neighbor',resident:'bea',planId:'bea:1'}))
    assert.ok(reload(farm))
  }
})

test('closed book, wrong card, stale meeting, changed food and sold-out shelves cannot navigate or auto-repeat',async()=>{
  for(const reason of ['closed','panel','resident','plan','food','sold']){
    const {farm,id}=prepared(),h=handler(farm,id)
    if(reason==='closed')h.state.dialog.open=false
    if(reason==='panel')h.state.panel='recipes'
    if(reason==='resident')h.state.communityResident='finn'
    if(reason==='plan')h.state.value='bea:999'
    if(reason==='food')h.state.control.dataset.food='dish:strawberryTart'
    if(reason==='sold')farm.bayShop.slots[2]!.quantity=0
    const before=structuredClone(farm);await h.run()
    assert.deepEqual(h.destinations,[]);assert.deepEqual(farm,before);assert.equal(h.state.requestedFood,undefined)
    if(reason==='food'||reason==='sold')assert.deepEqual(h.redraws,['draw'])
  }
})

test('navigation owns the activation gesture across the shop redraw',()=>{
  assert.equal(isGuardedAction('neighbor-shelf-food'),true)
  const mouse=new ActionClickGuard(),event={detail:1,timeStamp:100,clientX:150,clientY:200}
  mouse.remember(event);assert.equal(mouse.blocks({...event,detail:2,timeStamp:200}),true)
  const keys=new ActivationKeyGuard();assert.equal(keys.blocks({key:'Enter',repeat:false},true),false)
  assert.equal(keys.blocks({key:'Enter',repeat:true},false),true);keys.release('Enter')
  assert.equal(keys.blocks({key:'Enter',repeat:false},false),false)
})

test('the real meeting card offers the shelf route only while the selected food remains there',async()=>{
  const server=await createServer({server:{middlewareMode:true},appType:'custom'})
  try{
    const {neighborDetail}=await server.ssrLoadModule('/src/community-ui.ts'),{farm}=prepared(),before=structuredClone(farm)
    const art={icon:()=>'<img alt="">',offerIcon:()=>'<img alt="">'}
    const html=neighborDetail(farm,'bea',art)
    assert.match(html,/data-action="neighbor-shelf-food" data-value="bea:1" data-food="signature:s1"/)
    assert.match(html,/В лавку за угощением/);assert.doesNotMatch(html,/Выбранное угощение закончилось/);assert.deepEqual(farm,before)
    farm.bayShop.slots[2]!.quantity=0
    const sold=neighborDetail(farm,'bea',art)
    assert.doesNotMatch(sold,/neighbor-shelf-food/);assert.match(sold,/Выбранное угощение закончилось/)
  }finally{await server.close()}
})
