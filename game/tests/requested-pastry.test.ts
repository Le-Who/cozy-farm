import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import {test} from 'node:test'
import ts from 'typescript'
import {bakeWorkshop,deliverIntentOrder,getCommunityOrders,getIntentOffers,getWorkshopAction,restoreFarm,workshopDefinitions} from '../src/farm.ts'
import {requestedPastryFixture} from './fixtures/requested-pastry.ts'

// Exercise the actual UI handlers without importing main's browser/renderer startup.
const parse=(path:string)=>ts.createSourceFile(path,readFileSync(new URL(path,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true)
const main=parse('../src/main.ts'),workshop=parse('../src/workshop.ts')
const start=main.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='startRequestedFood')!
assert.ok(start)
const js=(source:string)=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText

function startChoice(source:unknown,previous='round') {
  const opened:string[]=[],calls:string[]=[]
  const state={pastryShape:previous,workshopRecipe:'bread',cookingDish:'appleJam',cookingMode:'signature',cookingFish:'seaBass',farm:{},
    requestedRecipe:()=>source,openPanel:(panel:string)=>opened.push(panel),guideRequestedFood:()=>calls.push('guide'),
    repeatRequestedFood:()=>calls.push('repeat'),getGrillFish:()=> 'sardine'}
  runInNewContext(js(`${start.getText(main)}\nstartRequestedFood()`),state)
  return {state,opened,calls}
}

test('starting a requested pastry carries each exact shape over every previous choice, without baking',()=>{
  const {farm}=requestedPastryFixture(),before=structuredClone(farm)
  for(const shape of ['round','folded','long'] as const)for(const previous of ['round','folded','long']) {
    const offer=getIntentOffers(farm,'portable').find(offer=>offer.id===`handmade:${shape}`)!
    assert.ok(offer.eligible)
    const {state,opened,calls}=startChoice({offer,action:getWorkshopAction(farm)},previous)
    assert.equal(state.pastryShape,shape);assert.equal(state.workshopRecipe,'pastry')
    assert.deepEqual(opened,['workshop']);assert.deepEqual(calls,[])
  }
  assert.deepEqual(farm,before)
})

test('missing ingredients or a stale request retain the existing guide instead of opening or changing pastry',()=>{
  for(const missing of ['egg','wheat','location']) {
    const {farm}=requestedPastryFixture(missing==='egg')
    if(missing==='wheat')farm.produce.wheat=1
    if(missing==='location')farm.island='grove'
    const before=structuredClone(farm),offer=getIntentOffers(farm,'portable').find(offer=>offer.id==='handmade:folded')!
    for(const source of [undefined,{offer,action:getWorkshopAction(farm)}]) {
      const {state,opened,calls}=startChoice(source,'long')
      assert.equal(state.pastryShape,'long');assert.equal(state.workshopRecipe,'bread')
      assert.deepEqual(opened,[]);assert.deepEqual(calls,['guide'])
    }
    assert.equal(bakeWorkshop(farm,'folded').ok,false);assert.deepEqual(farm,before)
  }
})

test('ordinary dishes, bakery bread and exact recipe repeats keep their existing routes',()=>{
  for(const identity of ['appleJam','farmhouseBread','grilledFish']) {
    const {state,opened,calls}=startChoice({offer:{source:'dish',identity},action:{available:true}},'folded')
    assert.equal(state.pastryShape,'folded');assert.equal(state.cookingDish,identity)
    assert.equal(state.cookingMode,'dish');assert.deepEqual(calls,[])
    assert.deepEqual(opened,[identity==='farmhouseBread'?'workshop':'cookery'])
    if(identity==='farmhouseBread')assert.equal(state.workshopRecipe,'bread')
    if(identity==='grilledFish')assert.equal(state.cookingFish,'sardine')
  }
  const repeat=startChoice({offer:{source:'signature'},action:{available:true}},'long')
  assert.deepEqual(repeat.calls,['repeat']);assert.deepEqual(repeat.opened,[]);assert.equal(repeat.state.pastryShape,'long')
})

test('the existing workshop picker can still change the suggested shape before baking',()=>{
  const create=workshop.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='createWorkshop') as ts.FunctionDeclaration
  const listener=create.body!.statements.find(node=>ts.isExpressionStatement(node)&&node.getText(workshop).startsWith('shapeButtons.forEach(button=>button.addEventListener'))!
  assert.ok(listener)
  const callbacks=new Map<string,()=>void>()
  let updates=0
  const state={chosenShape:'folded',contextLost:false,cutPending:false,stage:'ingredients',hand:{down:false},signal:undefined,
    shapeNames:{round:'Булочка',folded:'Слойка',long:'Батон'},updateState:()=>updates++,announce:()=>{},release:()=>{},
    shapeButtons:['round','long','folded'].map(shape=>({dataset:{shape},addEventListener:(_event:string,callback:()=>void)=>callbacks.set(shape,callback)}))}
  runInNewContext(js(listener.getText(workshop)),state)
  callbacks.get('long')!();assert.equal(state.chosenShape,'long')
  state.stage='working';callbacks.get('round')!();assert.equal(state.chosenShape,'round')
  assert.equal(updates,2)
  state.stage='baking';callbacks.get('folded')!();assert.equal(state.chosenShape,'round','the existing in-oven lock remains')
})

for(const shape of ['folded','long'] as const)test(`reload, exact baking and a separate single delivery retain the chosen ${shape}`,()=>{
  const original=requestedPastryFixture().farm
  const farm=restoreFarm(JSON.parse(JSON.stringify(original)))!;assert.ok(farm)
  const order=getCommunityOrders(farm).find(order=>order.intentId==='portable')!
  const offer=order.offers.find(offer=>offer.id===`handmade:${shape}`)!
  const started=startChoice({offer,action:getWorkshopAction(farm)})
  assert.equal(started.state.pastryShape,shape);assert.deepEqual(farm,original)
  const coins=farm.coins,work=farm.workToday
  assert.equal(bakeWorkshop(farm,shape).ok,true)
  assert.equal(farm.handmade[shape],1);assert.equal(farm.handmade.round,0)
  assert.equal(farm.produce.wheat,original.produce.wheat-2);assert.equal(farm.eggs,original.eggs-1)
  assert.equal(farm.workToday,work+1);assert.equal(farm.coins,coins)
  assert.deepEqual(farm.intentOrders,original.intentOrders,'baking does not deliver the request')
  const loaded=restoreFarm(JSON.parse(JSON.stringify(farm)))!;assert.ok(loaded)
  assert.equal(deliverIntentOrder(loaded,order.id,offer.id).ok,true)
  assert.equal(loaded.handmade[shape],0);assert.equal(loaded.coins,coins+workshopDefinitions[shape].sellPrice+12)
  assert.equal(loaded.produce.wheat,farm.produce.wheat);assert.equal(loaded.eggs,farm.eggs)
  const delivered=structuredClone(loaded)
  assert.equal(deliverIntentOrder(loaded,order.id,offer.id).ok,false);assert.deepEqual(loaded,delivered)
  assert.ok(restoreFarm(loaded))
})
