import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {stripTypeScriptTypes} from 'node:module'
import {runInNewContext} from 'node:vm'
import {ActionClickGuard,ActivationKeyGuard,isGuardedAction} from '../src/action-click-guard.ts'
import * as Coop from '../src/coop-panel.ts'
import {transferBayGoods} from '../src/harbour-economy.ts'
import * as F from '../src/farm.ts'
import {renderCoopPanel} from '../src/coop-panel.ts'
import {getLocalWarehouseSupply,warehouseConfirmation,warehouseConfirmationValue,withdrawWarehouseSupply} from '../src/warehouse-guidance.ts'
import {commissionPlayer} from './fixtures/commission-player.ts'

const opening=JSON.parse(readFileSync(new URL('./fixtures/home-progress-actions.json',import.meta.url),'utf8'))
function earnedStoredEgg(){
 const p=commissionPlayer(opening);p.visit('home');p.act('specializeFacility','hatchery')
 const bed=p.state.beds.findIndex(x=>x.kind==='tilled')
 assert.ok(bed>=0);p.act('selectSeed','wheat');p.act('workBed',bed,0)
 const water=()=>{if(F.getBedAction(p.state,bed).kind==='water'){if(!p.state.water)p.act('refillWater');p.act('workBed',bed,0)}}
 water();p.act('feedChickens');p.night();p.act('collectEggs');water();p.night();p.act('workBed',bed,0)
 assert.deepEqual([p.actions,p.state.day,p.state.eggs,p.state.variants.egg?.rainbow],[117,16,7,1])
 p.act('deliverMarketOrder','flock')
 assert.equal(p.state.eggs,1)
 p.act('transferBayGoods','deposit','home','eggs',1)
 return p
}
const render=(f:F.FarmState)=>renderCoopPanel(f,{
 icon:(id:string)=>`<i data-icon="${id}"></i>`,
 row:(_icon:string,n:string,d:string,a='')=>`<li data-row="${n}">${d} ${a}</li>`,
 button:(label:string,action:string,enabled=true,opts?:{value?:string|number})=>`<button type="button" data-action="${action}" data-value="${opts?.value??''}"${enabled?'':' disabled'}>${label}</button>`,
 feedRow:()=>'',
})
const incubator=(f:F.FarmState)=>render(f).match(/<li data-row="Инкубатор">([\s\S]*?)<\/li>/)![1]
const request={kind:'eggs',quantity:1} as const
const reload=(f:F.FarmState)=>F.restoreCurrentFarm(JSON.parse(JSON.stringify(f)))!

const action='incubator-warehouse-egg'
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8')
const takeBranch=(a:string,b:string)=>{
  const start=main.indexOf(`    case '${a}':`),end=main.indexOf(`    case '${b}':`,start+1)
  return start<0||end<=start?'':main.slice(start,end)
}
const highlight=main.slice(main.indexOf('function highlightControl('),main.indexOf('async function showRequirement('))
const act=stripTypeScriptTypes(`${highlight}
switch(action){${takeBranch(action,'incubator-basket')}${takeBranch('incubate-egg','incubate-rare-egg')}}`)
const shown=(f:F.FarmState)=>incubator(f).match(/data-action="incubator-warehouse-egg" data-value="([^"]+)">Забрать яйцо со склада/)

function app(farm:F.FarmState){
  const trace:string[]=[]
  const row = {
    tabIndex: undefined as number|undefined,
    matches(selector:string){assert.equal(selector,'button:not(:disabled),[tabindex]');return false},
    classList:{add(s:string){assert.equal(s,'guidance-target')}},
    scrollIntoView(options:unknown){assert.deepEqual(JSON.parse(JSON.stringify(options)),{block:'center',behavior:'instant'});trace.push('reveal')},
    focus(options:unknown){assert.equal(row.tabIndex,-1);assert.deepEqual(JSON.parse(JSON.stringify(options)),{preventScroll:true});trace.push('incubator-row')},
  }, control={}
  let attached=true,writes=0
  const dialogContent={
    contains:(target:unknown)=>target===control&&attached,
    querySelectorAll:(selector:string)=>{assert.equal(selector,'.guidance-target');return []},
    querySelector:(selector:string)=>{
      assert.equal(selector,'.coop-primary [data-action="incubate-egg"]:not(:disabled)')
      const exists=/data-action="incubate-egg" data-value="">Положить яйцо/.test(incubator(farm))
      return exists?{closest:(s:string)=>{assert.equal(s,'.dialog-row');return row}}:null
    },
  }
  const exec=(name:string,value:string|undefined,opt:{panel?:string;open?:boolean;attached?:boolean}={})=>{
    attached=opt.attached??true
    runInNewContext(act,{...F,...Coop,withdrawWarehouseSupply,farm,action:name,value,dialogContent,
      HTMLButtonElement:class {},panel:opt.panel??'coop',dialog:{open:opt.open??true},control,
      perform(fn:()=>F.ActionResult){const result=fn();if(result.ok){writes++;trace.push('write')}return result.ok},
      playBaySound(sound:string){assert.equal(sound,'harbour.crate');trace.push(sound)},
    })
  }
  return {exec,trace,writes:()=>writes}
}
test('earned Day16 local ordinary egg appears as a separate reversible one-egg action, never spending rainbow or hatching',()=>{
 const p=earnedStoredEgg(),f=p.state,start=structuredClone(f)
 assert.deepEqual([p.actions,f.day,f.island,f.eggs,f.eggsReady,f.eggBaskets,f.hatchDay,f.variants.egg?.rainbow],[119,16,'home',0,0,0,null,1])
 const quote=getLocalWarehouseSupply(f,request)!;assert.equal(quote.quantity,1)
 assert.equal(F.getRareIncubatorEgg(f),undefined)
 const all=render(f),row=incubator(f),token=shown(f)?.[1]
 assert.ok(token,'ready local ordinary egg should expose a single action in the incubator, not just disabled Insert')
 assert.equal((all.match(/data-action="incubator-warehouse-egg"/g)??[]).length,1)
 assert.doesNotMatch(row,/data-action="(?:incubate-egg|incubate-rare-egg|incubator-basket)"/)
 assert.match(row,/Обычное яйцо на складе/)
 assert.deepEqual(f,start)
 const a=app(f)
 a.exec(action,token,{open:false});a.exec(action,token,{attached:false});a.exec(action,token,{panel:'rest'})
 a.exec(action,token+'stale');assert.equal(a.writes(),0);assert.deepEqual(f,start)
 a.exec(action,token)
 assert.equal(a.writes(),1)
 const received=structuredClone(f)
 assert.deepEqual([f.eggs,f.hatchDay,f.variants.egg?.rainbow,f.coins,f.workToday,f.freight.warehouses.home.eggs??0],
  [1,null,1,start.coins,start.workToday,0])
 assert.deepEqual(a.trace,['write','harbour.crate','reveal','incubator-row'])
 a.exec(action,token)
 assert.deepEqual(f,received);assert.equal(a.writes(),1)
 const returnable=reload(f)
 assert.ok(transferBayGoods(returnable,'deposit','home','eggs',1).ok)
 assert.deepEqual(returnable,start,'the existing warehouse deposit reverses the pickup, not a hidden incubation')
 const afterReload=reload(f);assert.deepEqual(f,afterReload);assert.ok(!shown(afterReload))
 const waiting=incubator(f)
 assert.match(waiting,/data-action="incubate-egg"[^>]*>Положить яйцо/)
 a.exec('incubate-egg',undefined)
 assert.deepEqual([a.writes(),f.eggs,f.hatchDay,f.variants.egg?.rainbow,f.coins],[2,0,18,1,start.coins])
 assert.match(incubator(f),/К отдыху дома/)
 console.log(JSON.stringify({earnedActions:119,day:16,oldNormalStock:0,newNormalStock:1,oldRare:1,newRare:1,afterPickupHatch:null,afterExplicitInsertHatch:18,reversible:true}))
})

test('missing, foreign, basket, ready ordinary nest, pending and full states do not offer a warehouse withdrawal',()=>{
 const p=earnedStoredEgg(),f=p.state,token=shown(f)?.[1]
 assert.ok(token)
 const later=reload(f);assert.ok(F.endDay(later).ok)
 const tomorrow=shown(later)?.[1];assert.ok(tomorrow&&tomorrow!==token)
 const sameStock=structuredClone(later),oldAction=app(later)
 oldAction.exec(action,token);assert.equal(oldAction.writes(),0);assert.deepEqual(later,sameStock)
 const withNest=reload(f);assert.ok(F.buyFeed(withNest).ok);assert.ok(F.feedChickens(withNest).ok);assert.ok(F.endDay(withNest).ok)
 assert.ok(withNest.eggsReady>0);assert.ok(!shown(withNest))
 const stale=app(withNest),nest=structuredClone(withNest)
 stale.exec(action,token);assert.equal(stale.writes(),0);assert.deepEqual(withNest,nest)
 assert.ok(F.collectEggs(withNest).ok)
 assert.match(incubator(withNest),/data-action="incubate-egg" data-value="">Положить яйцо/)
 assert.ok(!shown(withNest))
 const basket=reload(withNest);assert.ok(F.packEggBasket(basket).ok)
 if (basket.eggs) assert.ok(F.sellMarketItem(basket,'eggs',basket.eggs).ok)
 assert.equal(basket.eggBaskets,1);assert.equal(basket.freight.warehouses.home.eggs,1)
 assert.match(incubator(basket),/data-action="incubator-basket"/);assert.ok(!shown(basket))
 const elsewhere=reload(f),old=getLocalWarehouseSupply(elsewhere,request)!
 assert.ok(withdrawWarehouseSupply(elsewhere,request,warehouseConfirmation(warehouseConfirmationValue(old))).ok)
 assert.ok(F.sail(elsewhere,'grove').ok);assert.ok(transferBayGoods(elsewhere,'deposit','grove','eggs',1).ok)
 assert.ok(!shown(elsewhere));const away=app(elsewhere),prior=structuredClone(elsewhere)
 away.exec(action,token);assert.equal(away.writes(),0);assert.deepEqual(elsewhere,prior)
 assert.ok(F.sail(elsewhere,'home').ok);assert.match(incubator(elsewhere),/Положить радужное яйцо/);assert.ok(!shown(elsewhere))
 assert.ok(F.sellMarketItem(elsewhere,'variants:egg:rainbow',1).ok)
 assert.match(incubator(elsewhere),/incubate-egg[^>]* disabled/);assert.ok(!shown(elsewhere))
 const pending=reload(withNest);assert.ok(F.incubateEgg(pending).ok)
 assert.equal(pending.freight.warehouses.home.eggs,1)
 assert.match(incubator(pending),/К отдыху дома/);assert.ok(!shown(pending))
 assert.ok(F.endDay(pending).ok);assert.ok(F.endDay(pending).ok)
 assert.equal(pending.flockSize,F.maxFlockSize)
 assert.doesNotMatch(render(pending),/data-row="Инкубатор"|incubator-warehouse-egg/)
})

test('layout recognizes the same control as live; repeats/double-click cannot consume the replacement hatch action',()=>{
 const cssOwner=readFileSync(new URL('../src/coop-services.ts',import.meta.url),'utf8')
 assert.match(cssOwner,/\[data-action="incubator-warehouse-egg"\]:not\(:disabled\)/)
 assert.equal(isGuardedAction(action),true)
 for(const key of ['Enter',' ']){
   const guard=new ActivationKeyGuard()
   assert.equal(guard.blocks({key,repeat:false},true),false)
   assert.equal(guard.blocks({key,repeat:true},true),true)
   guard.release(key);assert.equal(guard.blocks({key,repeat:false},true),false)
 }
 const once=new ActionClickGuard(),click={detail:1,timeStamp:100,clientX:12,clientY:34}
 once.remember(click);assert.equal(once.blocks({...click,detail:2,timeStamp:160}),true)
})
