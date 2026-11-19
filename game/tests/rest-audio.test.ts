import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { FerryArrivalPresentation } from '../src/ferry-arrival-presentation.ts'
import { createFarm, endDay } from '../src/farm.ts'
import { canConfirmRest } from '../src/rest-preview.ts'
import { receiveFerryExpedition, sendFerryExpedition } from '../src/harbour-economy.ts'
import { closeShopBeforeRest } from '../src/shop-rest.ts'
import { earlyFerryFarm, tendEarlyFerryFarm } from './fixtures/early-ferry.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'
import { SalePresentation } from '../src/sale-presentation.ts'
import { shopRestFixture } from './fixtures/shop-rest.ts'
const main = await readFile(new URL('../src/main.ts', import.meta.url),'utf8')
const sleep = main.slice(main.indexOf("    case 'sleep': {"),main.indexOf("    case 'refill':"))
function run(farm:any, opts:any={}) {
 const events:string[]=[];let hatch=0
 const state={ferryArrival:new FerryArrivalPresentation(),committedRestClose:false,panelHistory:[],farm,panel:'rest',dialog:{open:true},value:String(farm.day),canConfirmRest,endDay,
  perform:(action:any)=>action().ok,playBaySound:(id:string)=>events.push(id),island:{showHatch:()=>hatch++},notify:()=>{},...opts}
 runInNewContext(`switch('sleep'){${sleep}}`,state)
 return {events,hatch,committedRestClose:state.committedRestClose}
}
test('exact sleep branch emits one dawn only after successful ordinary sleep',()=>{
 const f=createFarm(); assert.deepEqual(run(f),{events:['daybreak.shutters'],hatch:0,committedRestClose:true});assert.equal(f.day,2)
})
test('an expedition arriving on sleep substitutes berth for dawn',()=>{
 const f=createFarm();f.boatOwned=true;f.coins=50;assert.ok(sendFerryExpedition(f,'mill-buy').ok)
 assert.deepEqual(run(f),{events:['harbour.berth'],hatch:0,committedRestClose:true});assert.equal(f.freight.expeditions.active?.phase,'ready')
 // Ready but uncollected arrival is not replayed next day.
 assert.deepEqual(run(f),{events:['daybreak.shutters'],hatch:0,committedRestClose:true})
})
test('only a night reviewed from this voyage returns to its manifest; collecting is still a second gesture',()=>{
 for(const mode of ['matched','other-voyage','ordinary-home','stale-day'] as const){
  const farm=earlyFerryFarm();assert.ok(endDay(farm).ok);tendEarlyFerryFarm(farm)
  assert.ok(sendFerryExpedition(farm,'mill-grain').ok)
  const serial=farm.freight.expeditions.active!.serial,day=farm.day,coins=farm.coins,buns=farm.handmade.round,pages:string[]=[]
  const panelHistory=mode==='ordinary-home'?[]:[{panel:'bay-freight',ferryMorning:mode==='other-voyage'?serial+1:serial}]
  run(farm,{panelHistory,value:String(mode==='stale-day'?day-1:day),openPanel:(next:string,remember:boolean)=>{assert.equal(remember,false);pages.push(next)}})
  assert.deepEqual(pages,mode==='matched'?['bay-freight']:[])
  assert.equal(farm.day,day+(mode==='stale-day'?0:1));assert.equal(farm.coins,coins);assert.equal(farm.handmade.round,buns)
  if(mode==='matched'){
   assert.equal(panelHistory.length,0);assert.equal(farm.freight.expeditions.active?.phase,'ready')
   assert.ok(receiveFerryExpedition(farm).ok);assert.equal(farm.coins,coins+5);assert.equal(farm.handmade.round,buns+1)
   assert.equal(receiveFerryExpedition(farm).ok,false)
  }
 }
 assert.equal(isGuardedAction('sleep'),true)
})
test('legacy ferry arrival substitutes berth for dawn',()=>{
 const f=createFarm();f.boatOwned=true;f.freight.ship={phase:'sailing',from:'home',to:'grove',arrivesOn:2,cargo:[]}
 assert.deepEqual(run(f),{events:['harbour.berth'],hatch:0,committedRestClose:true})
})
test('blocked or stale confirmation has no dawn or save mutation',()=>{
 for(const opts of [{panel:'journal'},{dialog:{open:false}},{value:'0'},{perform:()=>false}]){
  const f=createFarm(),before=structuredClone(f);assert.deepEqual(run(f,opts),{events:[],hatch:0,committedRestClose:false});assert.deepEqual(f,before)
 }
})
test('actual rest-navigation and close-shop branches do not call wake-up sound',async()=>{
 const f=shopRestFixture(),before={day:f.day,coins:f.coins,quantity:f.bayShop.slots[0]?.quantity}
 const rest=main.slice(main.indexOf("    case 'rest-close-shop':"),main.indexOf("    case 'sleep':"))
 const events:string[]=[];const visits:any[]=[]
 const state={farm:f,panel:'rest',dialog:{open:true},value:String(f.day),closeShopBeforeRest,
 perform:(action:any)=>action().ok,playBaySound:(id:string)=>events.push(id),visitPanelAt:(...args:any[])=>visits.push(args)}
 await runInNewContext(`(async()=>{switch('visit-rest'){${rest}}})()`,state)
 assert.deepEqual(visits,[['home','rest']]);assert.deepEqual(events,[])
 await runInNewContext(`(async()=>{switch('rest-close-shop'){${rest}}})()`,state)
 assert.equal(f.bayShop.open,false);assert.deepEqual(events,[])
 assert.deepEqual({day:f.day,coins:f.coins,quantity:f.bayShop.slots[0]?.quantity},before)
})


test('the exact close listener consumes committed sleep once and preserves later ordinary close',()=>{
 const begin=main.indexOf("dialog.addEventListener('close', () => {")
 const source=main.slice(begin,main.indexOf("\n\napp.addEventListener('change'",begin))
 const events:string[]=[];let close!:()=>void
 const noop=()=>{},selection={reset:noop},salePresentation=new SalePresentation()
 salePresentation.open({kind:'market',key:'fruit:apple'},{index:0,scroll:0})
 const state={salePresentation,stopCoopServices:noop,committedRestClose:true,dialog:{open:false,addEventListener:(_id:string,fn:()=>void)=>{close=fn}},
  transplantSelection:selection,berryNurserySelection:selection,berryRenewalSelection:selection,recipeSurplusSelection:selection,
  playBaySound:(id:string)=>events.push(id),island:{setViewMode:noop,setCoveFocus:noop},app:{dataset:{scene:''}},
  stopHarbour:noop,stopFishing:noop,stopWorkshop:noop,stopCookery:noop,stopArrangement:noop,
  panel:'rest',seedPickerBed:undefined,panelHistory:[],updateCommunityReturn:noop}
 runInNewContext(source,state);close();assert.deepEqual(events,[]);assert.equal(state.committedRestClose,false);assert.equal(salePresentation.token,'')
 close();assert.deepEqual(events,['page.fold'])
 // A queued close delivered after reopening consumes only its own suppression.
 state.committedRestClose=true;state.dialog.open=true;close();assert.equal(state.committedRestClose,false)
 state.dialog.open=false;close();assert.deepEqual(events,['page.fold','page.fold'])
})

test('a successful hatching night preserves its extra hatch cue without a page fold',()=>{
 const f=createFarm();f.coopSpecialization='hatchery';f.hatchDay=f.day+1
 assert.deepEqual(run(f),{events:['daybreak.shutters','flock.hatch'],hatch:1,committedRestClose:true})
})


test('the exact successful sleep branch retains one reveal until the ready panel is visible',()=>{
 const f=createFarm();f.boatOwned=true;f.coins=50;sendFerryExpedition(f,'mill-buy')
 const ferryArrival=new FerryArrivalPresentation()
 assert.deepEqual(run(f,{ferryArrival}).events,['harbour.berth'])
 assert.equal(ferryArrival.take(f.freight.expeditions.active,false),false)
 assert.equal(ferryArrival.take(f.freight.expeditions.active,true),true)
 assert.equal(ferryArrival.take(f.freight.expeditions.active,true),false)
 const blocked=new FerryArrivalPresentation(),g=createFarm();g.boatOwned=true;g.coins=50;sendFerryExpedition(g,'mill-buy')
 run(g,{ferryArrival:blocked,perform:()=>false})
 endDay(g)
 assert.equal(blocked.take(g.freight.expeditions.active,true),false)
})
