import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { createFarm, endDay } from '../src/farm.ts'
import { canConfirmRest } from '../src/rest-preview.ts'
import { sendFerryExpedition } from '../src/harbour-economy.ts'
import { closeShopBeforeRest } from '../src/shop-rest.ts'
import { shopRestFixture } from './fixtures/shop-rest.ts'
const main = await readFile(new URL('../src/main.ts', import.meta.url),'utf8')
const sleep = main.slice(main.indexOf("    case 'sleep': {"),main.indexOf("    case 'refill':"))
function run(farm:any, opts:any={}) {
 const events:string[]=[];let hatch=0
 const state={committedRestClose:false,farm,panel:'rest',dialog:{open:true},value:String(farm.day),canConfirmRest,endDay,
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
 const noop=()=>{},selection={reset:noop}
 const state={committedRestClose:true,dialog:{open:false,addEventListener:(_id:string,fn:()=>void)=>{close=fn}},
  transplantSelection:selection,berryNurserySelection:selection,berryRenewalSelection:selection,recipeSurplusSelection:selection,
  playBaySound:(id:string)=>events.push(id),island:{setViewMode:noop,setCoveFocus:noop},app:{dataset:{scene:''}},
  stopHarbour:noop,stopFishing:noop,stopWorkshop:noop,stopCookery:noop,stopArrangement:noop,
  panel:'rest',seedPickerBed:undefined,panelHistory:[],updateCommunityReturn:noop}
 runInNewContext(source,state);close();assert.deepEqual(events,[]);assert.equal(state.committedRestClose,false)
 close();assert.deepEqual(events,['page.fold'])
 // A queued close delivered after reopening consumes only its own suppression.
 state.committedRestClose=true;state.dialog.open=true;close();assert.equal(state.committedRestClose,false)
 state.dialog.open=false;close();assert.deepEqual(events,['page.fold','page.fold'])
})

test('a successful hatching night preserves its extra hatch cue without a page fold',()=>{
 const f=createFarm();f.coopSpecialization='hatchery';f.hatchDay=f.day+1
 assert.deepEqual(run(f),{events:['daybreak.shutters','flock.hatch'],hatch:1,committedRestClose:true})
})
