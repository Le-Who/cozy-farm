import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import * as F from '../src/farm.ts'
import {getRequirementHint} from '../src/requirement-guidance.ts'
import {saleStock,exactSaleQuote} from '../src/exact-sale.ts'
import {SalePresentation} from '../src/sale-presentation.ts'
import {ActivationKeyGuard,isGuardedAction} from '../src/action-click-guard.ts'

const cape={kind:'journey',island:'cape',id:'boat'} as const
const result={family:'preserves',processing:'silky',fruit:[],steps:['mix','pour']} as const
function player(initial=F.createFarm()){
 let farm=F.restoreCurrentFarm(structuredClone(initial))!,used=0
 const commands=F as Record<string,Function>
 return {get farm(){return farm},get used(){return used},
  act(name:string,...args:unknown[]){const result=commands[name](farm,...args);assert.ok(result.ok,name+': '+result.message)
  used++;farm=F.restoreCurrentFarm(JSON.parse(JSON.stringify(farm)))!;assert.ok(farm,name);return result},
 }
}
function firstJam(collectEggs=false){
 const p=player();for(const index of [2,3,4])p.act('workBed',index,0)
 p.act('deliverMarketOrder','garden');p.act('upgradeBuilding','farmhouse');p.act('pickFruit',0);p.act('cookDish','appleJam',result)
 if(collectEggs)p.act('collectEggs')
 return p
}
function firstDock(p:ReturnType<typeof player>){
 p.act('buyBoat');p.act('sail','grove');p.act('pickFruit',0);p.act('gatherSeaSalt');p.act('deliverProject','dock')
}

test('earned Day1 first Cape funding keeps the sole jam, restoring a real same-day vs overnight product decision',()=>{
 const p=firstJam(),f=p.farm,before=structuredClone(f)
 assert.deepEqual([p.used,f.day,f.coins,f.boatOwned,f.dishes.appleJam,f.produce.wheat,f.produce.tomato],[7,1,35,false,1,3,2])
 const garden=F.getMarketOrders(f).find(o=>o.lane==='garden'),kitchen=F.getMarketOrders(f).find(o=>o.lane==='kitchen')
 assert.deepEqual([garden?.status,kitchen?.status,kitchen?.name,kitchen?.reward],['delivered','ready','Варенье и зерно',30])
 const help=getRequirementHint(f,cape)
 assert.deepEqual([help.action.target,help.action.value],['market-sale-review','produce:tomato'])
 assert.deepEqual(f,before,'the funding question cannot sell or start the boat')
 const ready=player(f),sold=player(f),contract=player(f)
 ready.act('sellMarketItem',help.action.value,1)
 assert.deepEqual([ready.farm.coins,ready.farm.dishes.appleJam,ready.farm.produce.wheat],[40,1,3])
 assert.equal(F.getMarketOrders(ready.farm).find(x=>x.lane==='kitchen')?.status,'ready','the order remains independently explicit')
 firstDock(ready);ready.act('sail','cape')
 assert.deepEqual([ready.farm.day,ready.farm.island,ready.farm.coins,ready.farm.produce.wheat],[1,'cape',59,3])
 sold.act('sellMarketItem','dishes:appleJam',1)
 assert.deepEqual([sold.farm.coins,sold.farm.dishes.appleJam],[49,0])
 firstDock(sold)
 assert.deepEqual([sold.farm.day,F.canSailTo(sold.farm,'cape'),sold.farm.coins,sold.farm.produce.wheat],[1,false,13,3])
 contract.act('deliverMarketOrder','kitchen')
 assert.deepEqual([contract.farm.coins,contract.farm.produce.wheat,contract.farm.dishes.appleJam],[65,1,0])
 firstDock(contract)
 assert.deepEqual([contract.farm.day,F.canSailTo(contract.farm,'cape'),contract.farm.coins],[1,false,29])
 contract.act('sail','home');contract.act('endDay');contract.act('pickFruit',0);contract.act('cookDish','appleJam',result);contract.act('sail','grove');contract.act('deliverProject','dock')
 assert.deepEqual([contract.farm.day,F.canSailTo(contract.farm,'cape'),contract.farm.coins],[2,true,84])
 const reinvest=player(f);reinvest.act('deliverMarketOrder','kitchen');reinvest.act('upgradeBuilding','well');reinvest.act('upgradeBuilding','coop')
 assert.equal(F.getProject(reinvest.farm,'fair').status,'ready')
 assert.equal(F.getFairGuest(reinvest.farm),undefined,'locked Fair guest was not invented as a first-day option')
 console.log(JSON.stringify({day:1,firstJamAfter:7,coins:35,needed:36,crop:'tomato',cropPayout:5,
  preserve:{firstCapeDay:1,coins:59,wheat:3},directJam:{dayOneCape:false,coinsAfterPartial:13},
  kitchenOrder:{payout:30,firstCapeDay:2,coins:84},reinvestPurpose:'Fair',browser:false}))
})

test('funding only substitutes safe ordinary surplus for an order that consumes needed jam, not generic guidance or stale stock',()=>{
 const before=firstJam().farm
 assert.equal(getRequirementHint(before,cape).action.target,'market-sale-review')
 for(const destination of ['grove','village'] as const){
   assert.deepEqual(getRequirementHint(before,{...cape,island:destination}).action.value,'orders')
 }
 const fundedPantry=firstJam(true);fundedPantry.act('buySeeds','cabbage')
 const pantry=fundedPantry.farm
 assert.equal(pantry.coins,34)
 assert.equal(F.getMarketOrders(pantry).filter(x=>x.status==='ready')[0].lane,'pantry')
 assert.equal(getRequirementHint(pantry,cape).action.value,'orders','noncompeting ready order is already a valid alternative')
 const surplus=structuredClone(before);surplus.coins=32;surplus.produce.tomato=0
 // Synthetic threshold controls on an earned save: extra wheat at 3 coins cannot cover deficit4.
 assert.equal(F.getMarketOrders(surplus).find(x=>x.lane==='kitchen')?.status,'ready')
 assert.equal(getRequirementHint(surplus,cape).action.value,'orders')
 surplus.coins=33
 assert.deepEqual([getRequirementHint(surplus,cape).action.target,getRequirementHint(surplus,cape).action.value],['market-sale-review','produce:wheat'])
 surplus.produce.wheat=2
 assert.equal(getRequirementHint(surplus,cape).action.value,'orders','no spare wheat from a ready order')
 const more=structuredClone(before);more.dishes.appleJam=2
 assert.equal(getRequirementHint(more,cape).action.value,'orders')
 const gone=player(before);gone.act('sellMarketItem','dishes:appleJam',1)
 assert.equal(getRequirementHint(gone.farm,cape).action.target,'focus-place')
 const open=player(before);open.act('sellMarketItem','produce:tomato',1);open.act('buyBoat')
 assert.equal(getRequirementHint(open.farm,cape).action.target,'sail')
})

const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const between=(a:string,b:string)=>{const i=main.indexOf(a),j=main.indexOf(b,i+1);assert.ok(i>=0&&j>i,[a,b]);return main.slice(i,j)}
const code=stripTypeScriptTypes(`${between('function focusKey(', 'let harbourScene:')}
${between('function isSaleSurface()', 'let disposeCoopServices:')}
${between('async function showRequirement(', '// Scene handlers own material sounds.')}
async function tap(action,value,control){switch(action){
${between("    case 'boat-funds':","    case 'first-ferry-route':")}
${between("    case 'confirm-sale':","    case 'sale-again':")}
}}
function openPanel(next, remember=true) {
${main.split('\n').find(line=>line.startsWith('  if(remember&&next!==panel){'))}
 panel=next;visits.push(next)
}`)
function page(farm:F.FarmState){
 const fields='selectedMarketOrder marketSaleFamily marketSaleQuery marketTab marketCategory marketSellGroup bagTab archiveGroup inventoryGroup treeSlot previewSeed specializationBuilding previewSpecialization irrigationMode villageSlot pastryShape workshopRecipe cookingDish cookingFish seedPickerBed signatureBase signatureSlot signatureRepeatId expandedRepeatId cookingMode communityOrderId communityResident requestedFood kitchenTart kitchenPreserves kitchenGroup kitchenDish honeyKitchenDish signatureFamily'.split(' ')
 const extra=Object.fromEntries(fields.map(key=>[key,undefined]))
 const quotes:string[]=[],visits:string[]=[],notices:string[]=[],commits:string[]=[]
 class Btn{
  dataset:{action:string;value?:string};inCard=true
  constructor(action:string,value?:string){this.dataset={action,value}}
  closest(q:string){return q==='.exact-sale'?{dataset:{saleToken:c.salePresentation.token}}
    : this.inCard && q==='.journey-card[data-island="cape"]'?{}:null}
  focus(_options:unknown){quotes.push(this.dataset.action)}
  getClientRects(){return [1]}
 }
 const ready=new Btn('boat-funds','cape')
 const confirm=new Btn('confirm-sale')
 const neutral=new Btn('sale-heading')
 const receipt=new Btn('sale-receipt')
 const c:any={...F,...extra,farm,boatIsland:'cape',getRequirementHint,saleStock,exactSaleQuote,salePresentation:new SalePresentation(),
  selectedSale:undefined,saleQuantity:'',saleReceipt:undefined,panel:'boat',panelHistory:[],signatureSlots:[],restoreFerryPanelView:()=>{},
  selectedWarehouseRequest:undefined,selectedExpeditionPort:'mill',selectedExpeditionOffer:'mill-grain',selectedWarehouse:'home',freightPlanOpen:false,journeyDetailsOpen:false,
  recipeBook:{snapshot:()=>({mode:'index'}),load:()=>{}},panelRenderVersion:1,requestAnimationFrame:(fn:()=>void)=>fn(),
  marketSaleQuery:'груша',marketSaleFamily:'fruit:pear',marketTab:'buy',marketCategory:'trees',marketSellGroup:'harvest',
  document:{activeElement:ready},HTMLButtonElement:Btn,dialog:{open:true,querySelectorAll:()=>[ready]},
  dialogContent:{scrollTop:17,contains:(b:unknown)=>b===ready||b===confirm,querySelectorAll:()=>[],
   querySelector:(q:string)=>q==='.exact-sale h2'?neutral:q==='.exact-sale-receipt'?receipt:null},
  goods:()=>F.getMarketStock(farm).filter(q=>q.count>0).map(q=>({...q,name:q.key})),
  event:{detail:0},visits,notify:(s:string)=>notices.push(s),playBaySound:()=>{},
  openGuidedMarket:(value:string)=>{visits.push('guided '+value)},highlightControl:()=>{},
  perform(fn:()=>F.ActionResult){const r=fn();if(r.ok)commits.push(r.message);return r.ok},
 }
 runInNewContext(code,c)
 return {c,ready,confirm,quotes,visits,notices,commits}
}
test('actual Cape click opens the existing one-unit quote with neutral focus; repeated Back restores selection and does not arm sale',async()=>{
 const f=firstJam().farm,before=structuredClone(f),h=page(f),v=h.c
 for(let i=0;i<2;i++){
  await v.tap('boat-funds','cape',h.ready)
  assert.equal(v.panel,'sale');assert.equal(v.saleQuantity,'1')
  assert.equal(v.selectedSale.key,'produce:tomato');assert.equal(v.saleReceipt,undefined)
  const current=saleStock(f,v.selectedSale)!
  assert.deepEqual(exactSaleQuote(v.saleQuantity,current.count,current.price),{valid:true,quantity:1,total:5,remaining:1})
  assert.equal(h.quotes.at(-1),'sale-heading');assert.equal(h.commits.length,0);assert.deepEqual(f,before)
  v.boatIsland='home';v.dialogContent.scrollTop=1;v.goBack(true)
  assert.equal(v.boatIsland,'cape');assert.equal(v.panel,'boat');assert.equal(v.dialogContent.scrollTop,17);assert.equal(h.quotes.at(-1),'boat-funds')
  assert.equal(v.marketSaleQuery,'груша');assert.equal(v.marketSaleFamily,'fruit:pear');assert.equal(v.marketTab,'buy');assert.equal(v.marketCategory,'trees')
 }
 await v.tap('boat-funds','cape',h.ready)
 await v.tap('confirm-sale',undefined,h.confirm)
 assert.deepEqual([f.coins,f.produce.tomato,f.produce.wheat,f.dishes.appleJam],[40,1,3,1])
 assert.equal(h.commits.length,1);assert.ok(F.restoreCurrentFarm(structuredClone(f)))
 await v.tap('confirm-sale',undefined,h.confirm);assert.equal(h.commits.length,1)
})

test('stale panel, detached card and held activation do not spend; changed stock recomputes before presenting',async()=>{
 const f=firstJam().farm,before=structuredClone(f),h=page(f),v=h.c
 v.panel='market';await v.tap('boat-funds','cape',h.ready);v.panel='boat'
 v.dialog.open=false;await v.tap('boat-funds','cape',h.ready);v.dialog.open=true
 v.boatIsland='grove';await v.tap('boat-funds','cape',h.ready);v.boatIsland='cape'
 await v.tap('boat-funds','cape',{});await v.tap('boat-funds','false',h.ready)
 assert.deepEqual(h.visits,[]);assert.deepEqual(f,before)
 const changed=structuredClone(f);changed.produce.tomato=0;changed.produce.wheat=2
 assert.equal(F.getMarketOrders(changed).find(x=>x.lane==='kitchen')?.status,'ready')
 const fallback=page(changed),pre=structuredClone(changed)
 await fallback.c.tap('boat-funds','cape',fallback.ready);assert.deepEqual(fallback.visits,['guided orders'])
 assert.equal(fallback.c.selectedSale,undefined);assert.deepEqual(changed,pre)
 assert.ok(isGuardedAction('boat-funds'))
 for(const key of ['Enter',' ']){
  const keys=new ActivationKeyGuard();assert.equal(keys.blocks({key,repeat:false},true),false)
  assert.equal(keys.blocks({key,repeat:true},false),true);keys.release(key)
  assert.equal(keys.blocks({key,repeat:false},true),false)
 }
})
