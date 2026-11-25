import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import test from 'node:test'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import * as H from '../src/harbour-economy.ts'
import * as W from '../src/warehouse-guidance.ts'
import {getRequirementHint} from '../src/requirement-guidance.ts'
import {getSupplyGuidance} from '../src/discovery-path.ts'
import {createFishingModel} from '../src/fishing-model.ts'
const copy=x=>structuredClone(x)
const reload=x=>{const f=F.restoreCurrentFarm(JSON.parse(JSON.stringify(x)));assert.ok(f);assert.deepEqual(f,x);return f}
const grove=f=>F.getMarketOrders(f).find(x=>x.lane==='grove')
const skim=f=>({day:f.day,island:f.island,coins:f.coins,bass:f.fish.seaBass,carrot:f.produce.carrot,salt:f.seaSalt,collectedToday:f.saltGatheredToday,
  grill:f.dishes.grilledFish,groveOrder:grove(f)?.status,grovePayout:grove(f)?.reward,
  homeSalt:f.freight.warehouses.home.seaSalt??0,groveSalt:f.freight.warehouses.grove.seaSalt??0,transport:f.freight.expeditions.active?.id??null})
const acts={...F,...H,...W}
function player(initial=F.createFarm()){
 let farm=reload(copy(initial)); const log=[]
 const act=(n,...a)=>{const res=acts[n](farm,...a);assert.ok(res.ok,n+JSON.stringify(a)+': '+res.message);farm=reload(farm);log.push([n,a,skim(farm)]);return res}
 const visit=id=>{if(farm.island!==id)act('sail',id)}
 const catchOrdinary=(count=1)=>{
  for(let remaining=count;remaining>0;){
   const island=farm.island,species=island==='grove'?'seaBass':'perch'
   const t=act('beginFishingTrip'),seed=farm.day*1009+t.token*9176+(island==='grove'?71:17)
   const fish=createFishingModel(t.config.capacity,t.config.resilience,seed,species,t.config.habitat).fish.map(x=>x.loot)
   const loot=fish.filter(x=>x?.kind==='fish'&&x.species===species&&x.variant==='regular').slice(0,Math.min(remaining,t.config.capacity))
   assert.ok(loot.length,'ordinary catch is present in actual generated model')
   act('finishFishingTrip',t.token,loot)
   remaining-=loot.length
  }
 }
 return {get farm(){return farm},log,act,visit,catchOrdinary}
}
const grillReceipt={family:'grilledFish',fishSpecies:'seaBass',fruit:[],garnish:[{ingredientId:'carrot',x:0.2,y:0.1,angle:0}],baking:{method:'grill',finish:'golden',seconds:5},
 steps:['season-fish','grill-first-side','turn-fish','grill-second-side','plate-fish','arrange-carrot']}
const salt={kind:'seaSalt',quantity:1}, request={kind:'stock',item:salt}
const get=x=>getRequirementHint(x,request)
const testSaltCollection=(p,n)=>{const snap=reload(copy(p.farm)); const res=F.gatherSeaSalt(snap);assert.equal(res.ok,n);if(!n)assert.deepEqual(snap,p.farm);return res.message}
function earnLastSalt() {
  const p=player()
  for(const [n,...a] of [['workBed',2,0],['sellMarketItem','produce:cabbage',2],['buyBoat'],['workBed',5,0],['selectSeed','beetroot'],['workBed',13,0],['workBed',13,0],['sail','grove'],['pickFruit',0],['gatherSeaSalt']])p.act(n,...a)
  p.catchOrdinary();p.visit('home');p.act('endDay')
  p.act('deliverMarketOrder','grove');p.act('upgradeBuilding','farmhouse');p.act('workBed',13,0)
  p.act('endDay');p.act('workBed',13,0);p.act('deliverMarketOrder','grove')
// One salt from the first visit remains. Cook legitimately, then sell to fund the farm before Day4.
  p.act('workBed',1,0);p.act('workBed',9,0);p.visit('grove');p.catchOrdinary();p.visit('home')
  assert.equal(F.getCookAction(p.farm,'grilledFish','seaBass').available,true)
  p.act('cookDish','grilledFish',grillReceipt);p.act('sellMarketItem','dishes:grilledFish')
  p.act('endDay');p.act('workBed',1,0);p.visit('grove');p.act('gatherSeaSalt');p.catchOrdinary(2);p.visit('home')
  p.act('cookDish','grilledFish',grillReceipt);p.act('sellMarketItem','dishes:grilledFish')
  return p
}

function applyWithdrawal(p:ReplayPlayer, item=salt){
  const supply=W.getLocalWarehouseSupply(p.farm,item)
  assert.ok(supply)
  p.act('withdrawWarehouseSupply',item,W.warehouseConfirmation(W.warehouseConfirmationValue(supply)))
  return supply
}
type ReplayPlayer=ReturnType<typeof player>
const homePreview=()=>{ const p=player(earnLastSalt().farm);p.act('cookDish','grilledFish',grillReceipt);return p }
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const between=(start:string,end:string)=>{
  const a=main.indexOf(start),b=main.indexOf(end,a+1)
  assert.ok(a>=0&&b>a)
  return main.slice(a,b)
}
// Use the actual ingredient, travel and warehouse-confirm event bodies. The
// simulated shell records panels but all travel/economy uses production reducers.
const interaction=stripTypeScriptTypes(between('async function showRequirement(', '// Scene handlers own material sounds.')
  +'\nasync function handle(action,value,control){switch(action){'
  +between("    case 'warehouse-supply-withdraw':","    case 'picnic-field':")+'}}')
function playIngredient(farm: ReturnType<typeof F.createFarm>, item= salt) {
  const opens:string[]=[], crosses:string[]=[], highlights:unknown[]=[], notices:unknown[]=[]
  const ctx:any={...F,...W,farm,panel:'market',dialog:{open:true}, getRequirementHint,
    requirementLinks:new Map([['ingredient-1',{kind:'stock',item}]]), selectedWarehouseRequest:undefined,
    fieldViewButton:{getAttribute:()=>null},
    closeDialog:()=>{ctx.dialog.open=false;ctx.panel=undefined},openPanel:(p:string)=>{ctx.panel=p;ctx.dialog.open=true;opens.push(p)},
    island:{crossIsland:async(fn:()=>boolean)=>{const ok=fn();if(ok)crosses.push(farm.island);return ok}},
    dialogContent:{querySelector:(selector:string)=>selector},
    perform:(fn:()=>{ok:boolean})=>fn().ok,
    highlightControl:(control:unknown)=>highlights.push(control),notify:(notice:unknown)=>notices.push(notice),
    panelTitles:{rest:'Дом'}, bayAudio:{playEvent:()=>{}},
  }
  runInNewContext(interaction,ctx)
  return {ctx,opens,crosses,highlights,notices}
}

test('earned Day 4 Grove dinner needs cooking plus one separate salt, not a mandatory night if the Grove store is stocked',()=>{
  const p=earnLastSalt(), before=reload(copy(p.farm))
  assert.equal(p.log.length,37)
  assert.deepEqual([p.farm.day,p.farm.seaSalt,p.farm.saltGatheredToday,p.farm.dishes.grilledFish,p.farm.freight.warehouses.grove.seaSalt],[4,1,true,0,6])
  assert.equal(F.getCookAction(p.farm,'grilledFish','seaBass').available,true)
  const sold=player(before);sold.act('cookDish','grilledFish',grillReceipt);sold.act('sellMarketItem','dishes:grilledFish')
  assert.equal(sold.farm.coins-before.coins,38)
  assert.equal(grove(sold.farm)?.status,'waiting')

  const kept=player(before);kept.act('cookDish','grilledFish',grillReceipt)
  const pending=reload(copy(kept.farm))
  assert.deepEqual([pending.seaSalt,pending.dishes.grilledFish,grove(pending)?.status,kept.farm.freight.expeditions.active],[0,1,'waiting',null])
  assert.equal(W.getLocalWarehouseSupply(pending,salt),undefined,'no unstated local reserve or import')
  const direction=get(kept.farm),guide=getSupplyGuidance(kept.farm,salt,'заказ рощи')
  console.log(JSON.stringify({day:pending.day,local:pending.freight.warehouses.home.seaSalt??0,grove:pending.freight.warehouses.grove.seaSalt,requirement:direction.action,guide:guide.action}))
  assert.deepEqual([direction.action.target,direction.action.value],['sail','grove'])
  assert.deepEqual([guide.action.target,guide.action.value],['sail','grove'])
  assert.deepEqual(kept.farm,pending,'reading the source never sails or withdraws')

  kept.visit('grove')
  assert.match(testSaltCollection(kept,false),/К утру/,'a second field harvest really is unavailable today')
  assert.deepEqual([get(kept.farm).action.target,W.getLocalWarehouseSupply(kept.farm,salt)?.quantity],['warehouse-supply',1])
  applyWithdrawal(kept);kept.visit('home');kept.act('deliverMarketOrder','grove')
  assert.deepEqual([kept.farm.day,kept.farm.coins-before.coins,kept.farm.dishes.grilledFish,kept.farm.seaSalt],[4,52,0,0])
  assert.equal(kept.farm.freight.warehouses.grove.seaSalt,5)

  const tomorrow=player(pending);tomorrow.act('endDay');tomorrow.visit('grove')
  assert.equal(tomorrow.farm.saltGatheredToday,false)
  tomorrow.act('gatherSeaSalt');tomorrow.visit('home');tomorrow.act('deliverMarketOrder','grove')
  assert.deepEqual([tomorrow.farm.day,tomorrow.farm.coins-before.coins,tomorrow.farm.seaSalt],[5,52,1])
})

test('the actual ingredient click sails and opens only the existing withdrawal review; stale or repeated moves do not give more',async()=>{
  const p=homePreview(), before=copy(p.farm)
  const {ctx,opens,crosses,highlights}=playIngredient(p.farm)
  await ctx.handle('show-requirement','ingredient-1',{})
  assert.deepEqual(crosses,['grove']);assert.deepEqual(opens,['warehouse-supply']);assert.equal(highlights.length,1)
  assert.deepEqual(ctx.selectedWarehouseRequest,salt)
  const same=copy(before);assert.ok(F.sail(same,'grove').ok);assert.deepEqual(p.farm,same)
  const supply=W.getLocalWarehouseSupply(p.farm,salt)!
  assert.equal(supply.quantity,1)
  const token=W.warehouseConfirmationValue(supply)
  await ctx.handle('warehouse-supply-withdraw','home|seaSalt|1|1',{})
  assert.deepEqual(p.farm,same,'foreign quote not accepted')
  await ctx.handle('warehouse-supply-withdraw',token,{})
  assert.deepEqual([p.farm.day,p.farm.seaSalt,p.farm.dishes.grilledFish,p.farm.coins,p.farm.freight.warehouses.grove.seaSalt],[4,1,1,before.coins,5])
  const paid=copy(p.farm)
  await ctx.handle('warehouse-supply-withdraw',token,{})
  assert.deepEqual(p.farm,paid,'already enough on second click, and still no delivery or night')
})

test('local or carried salt wins; otherwise only enough, currently accessible, same-day stock prevents the rest route',()=>{
  const local=homePreview()
  local.visit('grove');applyWithdrawal(local);local.visit('home')
  assert.equal(get(local.farm).action.value,'inventory')
  local.act('transferBayGoods','deposit','home','seaSalt',1)
  assert.equal(get(local.farm).action.target,'warehouse-supply')
  assert.equal(getSupplyGuidance(local.farm,salt,'заказ').action.target,'warehouse-supply')

  const empty=homePreview();empty.visit('grove');empty.act('transferBayGoods','withdraw','grove','seaSalt',6)
  empty.visit('home');empty.act('sellMarketItem','seaSalt',6)
  assert.equal(get(empty.farm).action.value,'rest')
  assert.equal(getSupplyGuidance(empty.farm,salt,'заказ').action.target,'visit-rest')
  const notEnough=homePreview();const seven={kind:'stock',item:{kind:'seaSalt',quantity:7}}
  assert.equal(getRequirementHint(notEnough.farm,seven).action.value,'rest')
  assert.equal(getSupplyGuidance(notEnough.farm,seven.item,'заказ').action.target,'visit-rest')
  const unopened=F.createFarm()
  assert.notEqual(get(unopened).action.value,'grove')
  const next=homePreview();next.act('endDay')
  assert.equal(get(next.farm).action.value,'grove','an ordinary fresh harvest route stays available')
  next.visit('grove');assert.equal(testSaltCollection(next,true),'Собрано 2 порции морской соли в заводи.')
})
