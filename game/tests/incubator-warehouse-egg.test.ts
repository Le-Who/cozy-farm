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
function earnedDay16(branch: 'hatchery' | 'packing' = 'hatchery'){
 const p=commissionPlayer(opening);p.visit('home');p.act('specializeFacility',branch)
 const bed=p.state.beds.findIndex(x=>x.kind==='tilled')
 assert.ok(bed>=0);p.act('selectSeed','wheat');p.act('workBed',bed,0)
 const water=()=>{if(F.getBedAction(p.state,bed).kind==='water'){if(!p.state.water)p.act('refillWater');p.act('workBed',bed,0)}}
 water();p.act('feedChickens');p.night();p.act('collectEggs');water();p.night();p.act('workBed',bed,0)
 assert.deepEqual([p.actions,p.state.day,p.state.eggs,p.state.variants.egg?.rainbow],[117,16,7,1])
 return p
}
function earnedStoredEgg(){
 const p=earnedDay16()
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
 assert.doesNotMatch(render(elsewhere),/data-row="Инкубатор"|incubator-warehouse-egg/)
 const away=app(elsewhere),prior=structuredClone(elsewhere)
 away.exec(action,token);assert.equal(away.writes(),0);assert.deepEqual(elsewhere,prior)
 assert.ok(F.sail(elsewhere,'home').ok);assert.match(incubator(elsewhere),/Положить радужное яйцо/);assert.ok(!shown(elsewhere))
 assert.ok(F.sellMarketItem(elsewhere,'variants:egg:rainbow',1).ok)
 assert.match(incubator(elsewhere),/1 обычное яйцо · в запасе 0 · 2 ночи/)
 assert.doesNotMatch(incubator(elsewhere),/data-action=/);assert.ok(!shown(elsewhere))
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

const packedAction='incubator-warehouse-basket'
const packedShown=(f:F.FarmState)=>incubator(f).match(/data-action="incubator-warehouse-basket" data-value="([^"]+)">Забрать корзину со склада/)
function earnedStoredBasket(baskets=1,loose=0){
 const p=earnedDay16()
 const plan={kind:'basket',placements:[{x:-.4,y:0},{x:0,y:0},{x:.4,y:0}],settled:true}
 for(let i=0;i<baskets;i++)p.act('packEggBasket',plan)
 if(loose)p.act('transferBayGoods','deposit','home','eggs',loose)
 if(p.state.eggs)p.act('sellMarketItem','eggs',p.state.eggs)
 p.act('transferBayGoods','deposit','home','eggBaskets',baskets)
 return p
}
const packedHandler=stripTypeScriptTypes(`${highlight}
switch(action){
 ${takeBranch(packedAction,'incubator-warehouse-egg')}
 ${takeBranch('incubator-basket','incubate-egg')}
 ${takeBranch('unpack-egg-basket','unpack-egg-crate')}
 ${takeBranch('incubate-egg','incubate-rare-egg')}
}`)
function packedApp(farm:F.FarmState){
 const trace:string[]=[]
 const makeRow=(id:string)=>{
  const classes=new Set<string>()
  return {tabIndex:undefined as number|undefined,classList:{add:(value:string)=>classes.add(value),remove:(value:string)=>classes.delete(value)},
    matches(q:string){assert.equal(q,'button:not(:disabled),[tabindex]');return this.tabIndex!==undefined},
    scrollIntoView:(q:unknown)=>{assert.deepEqual(JSON.parse(JSON.stringify(q)),{block:'center',behavior:'instant'});trace.push('reveal '+id)},
    focus:(q:unknown)=>{assert.deepEqual(JSON.parse(JSON.stringify(q)),{preventScroll:true});trace.push('focus '+id)},
    classes,id}
 }
 const incubatorRow=makeRow('incubator'),packingRow=makeRow('packing')
 const attached={'incubator':true, 'packing':true}
 const wrap=(row:ReturnType<typeof makeRow>)=>({closest:(q:string)=>q==='.dialog-row'?row
   : row===packingRow&&q==='.coop-packing .dialog-row.guidance-target'&&row.classes.has('guidance-target')?row:null})
 const packControl=wrap(packingRow),inputControl=wrap(incubatorRow)
 let writes=0
 const dialogContent={
   contains:(target:unknown)=>target===inputControl&&attached.incubator||target===packControl&&attached.packing,
   querySelectorAll:(q:string)=>q==='.guidance-target'?[packingRow,incubatorRow].filter(row=>row.classes.has('guidance-target')):[],
   querySelector:(q:string)=>q==='.coop-primary [data-action="incubate-egg"]:not(:disabled)'&&/data-action="incubate-egg" data-value="">/.test(incubator(farm))?inputControl
     :q==='.coop-packing [data-action="unpack-egg-basket"]:not(:disabled)'&&/data-action="unpack-egg-basket" data-value="">/.test(render(farm))?packControl:null,
 }
 const exec=(action:string,value?:string,opt:{panel?:string;open?:boolean;attached?:boolean}={})=>{
  attached.incubator=opt.attached??true;attached.packing=opt.attached??true
  runInNewContext(packedHandler,{...F,...Coop,withdrawWarehouseSupply,farm,action,value,dialogContent,
    HTMLButtonElement:class {},panel:opt.panel??'coop',dialog:{open:opt.open??true},control:action==='unpack-egg-basket'?packControl:inputControl,
    perform(fn:()=>F.ActionResult){const result=fn();if(result.ok){writes++;trace.push('player '+action)}return result.ok},
    playBaySound(sound:string){assert.equal(sound,'harbour.crate');trace.push(sound)}})
 }
 return {exec,trace,writes:()=>writes,incubatorRow,packingRow}
}
const packedStock=(f:F.FarmState)=>[f.eggs,f.eggBaskets,f.freight.warehouses.home.eggBaskets??0,f.hatchDay,f.variants.egg?.rainbow]

test('earned Day16 packed-only ordinary eggs are revealed and picked up locally without opening or incubating',()=>{
 const p=earnedStoredBasket(),f=p.state,before=structuredClone(f)
 assert.deepEqual([p.actions,f.day,f.island,f.eggsReady,...packedStock(f)],[120,16,'home',0,0,0,1,null,1])
 assert.equal(F.getRareIncubatorEgg(f),undefined)
 const token=packedShown(f)?.[1]
 assert.ok(token,'the exact previously unreachable warehouse basket needs one live Incubator CTA')
 assert.equal((render(f).match(/data-action="incubator-warehouse-basket"/g)??[]).length,1)
 assert.doesNotMatch(incubator(f),/data-action="(?:incubate-egg|incubate-rare-egg|incubator-warehouse-egg|incubator-basket)"/)
 assert.deepEqual(f,before,'drawing/refocusing does not reserve or spend stock')
 const app=packedApp(f)
 app.exec(packedAction,token,{attached:false});app.exec(packedAction,token,{open:false});app.exec(packedAction,token,{panel:'warehouse'})
 for(const bad of [undefined,'15:home|eggBaskets|1|1','16:grove|eggBaskets|1|1','16:home|eggBaskets|1|2','16:home|eggs|1|1'])app.exec(packedAction,bad)
 assert.equal(app.writes(),0);assert.deepEqual(f,before)
 app.exec(packedAction,token)
 assert.equal(app.writes(),1);assert.deepEqual(packedStock(f),[0,1,0,null,1])
 assert.deepEqual(app.trace,['player '+packedAction,'harbour.crate','reveal packing','focus packing'])
 assert.ok(app.packingRow.classes.has('guidance-target'));assert.ok(!app.incubatorRow.classes.has('guidance-target'));assert.equal(app.packingRow.tabIndex,-1)
 const afterPickup=reload(f);assert.deepEqual(f,afterPickup);assert.match(incubator(afterPickup),/data-action="incubator-basket"/)
 const reversible=structuredClone(afterPickup);assert.ok(transferBayGoods(reversible,'deposit','home','eggBaskets',1).ok);assert.deepEqual(reversible,before)
 app.exec(packedAction,token);assert.equal(app.writes(),1);assert.deepEqual(f,afterPickup)
 app.exec('unpack-egg-basket')
 assert.deepEqual(packedStock(f),[3,0,0,null,1]);assert.equal(app.writes(),2)
 assert.deepEqual(app.trace.slice(-3),['player unpack-egg-basket','reveal incubator','focus incubator'])
 assert.ok(!app.packingRow.classes.has('guidance-target'));assert.ok(app.incubatorRow.classes.has('guidance-target'));assert.equal(app.incubatorRow.tabIndex,-1)
 assert.deepEqual([f.coins,f.workToday,f.day],[before.coins,before.workToday,16])
 assert.match(incubator(f),/data-action="incubate-egg" data-value="">/)
 const unpacked=structuredClone(f)
 app.exec('unpack-egg-basket');assert.deepEqual(f,unpacked);assert.equal(app.writes(),2)
 app.exec('incubate-egg')
 assert.deepEqual(packedStock(f),[2,0,0,18,1]);assert.equal(app.writes(),3)
 assert.deepEqual([f.coins,f.workToday,f.day],[before.coins,before.workToday+1,16])
 console.log(JSON.stringify({day:16,earnedActions:120,source:'home one packed ordinary basket',flows:['withdraw one packed','unpack separately','insert one ordinary separately'],eggsLeft:2,hatchDay:18,rainbowLeft:1,coinsChanged:false,browser:false}))
})

test('ordinary nest/loose/held options keep their order, oldest packed action does not pick a second basket',()=>{
 const abundant=earnedStoredBasket(2).state
 const token=packedShown(abundant)?.[1]
 assert.ok(token)
 const a=packedApp(abundant)
 a.exec(packedAction,token)
 assert.deepEqual(packedStock(abundant),[0,1,1,null,1])
 a.exec(packedAction,token);assert.equal(a.writes(),1)
 assert.match(incubator(abundant),/data-action="incubator-basket"/);assert.equal(packedShown(abundant),null)
 const left=earnedStoredBasket(1,1).state
 assert.equal(packedShown(left),null);assert.ok(shown(left),'loose ordinary warehouse stock outranks packed')
 const previous=structuredClone(left)
 packedApp(left).exec(packedAction,token);assert.deepEqual(left,previous)
 const inStock=raisedOrdinaryNest(earnedStoredBasket().state)
 assert.equal(packedShown(inStock),null);assert.match(render(inStock),/data-action="collect" data-value="">/)
 assert.ok(F.collectEggs(inStock).ok);assert.match(incubator(inStock),/data-action="incubate-egg" data-value="">/)
 assert.equal(packedShown(inStock),null)
})
function raisedOrdinaryNest(f:F.FarmState){
 const next=reload(f)
 if(!next.feed)assert.ok(F.buyFeed(next).ok)
 if(!next.chickensFed)assert.ok(F.feedChickens(next).ok)
 assert.ok(F.endDay(next).ok);assert.ok(next.eggsReady>Number(next.eggTrait!==null));return next
}

test('foreign, missing, pending, full, stale-day and capacity-limited claims stay on their legitimate routes',()=>{
 const f=earnedStoredBasket().state,token=packedShown(f)?.[1];assert.ok(token)
 const older=reload(f);assert.ok(F.endDay(older).ok);const tomorrow=packedShown(older)?.[1]
 assert.ok(tomorrow&&tomorrow!==token);const untouched=structuredClone(older)
 packedApp(older).exec(packedAction,token);assert.deepEqual(older,untouched)
 const abroad=reload(f)
 assert.ok(transferBayGoods(abroad,'withdraw','home','eggBaskets',1).ok)
 assert.ok(F.sail(abroad,'grove').ok)
 assert.ok(transferBayGoods(abroad,'deposit','grove','eggBaskets',1).ok)
 assert.doesNotMatch(render(abroad),/data-row="Инкубатор"|incubator-warehouse-basket/)
 const away=structuredClone(abroad);packedApp(abroad).exec(packedAction,token);assert.deepEqual(abroad,away)
 assert.ok(F.sail(abroad,'home').ok)
 assert.match(incubator(abroad),/Положить радужное яйцо/);assert.equal(packedShown(abroad),null)
 const pending=raisedOrdinaryNest(f);assert.ok(F.collectEggs(pending).ok);assert.ok(F.incubateEgg(pending).ok)
 assert.match(incubator(pending),/К отдыху дома/);assert.equal(packedShown(pending),null)
 assert.ok(F.endDay(pending).ok);assert.ok(F.endDay(pending).ok)
 assert.equal(pending.flockSize,F.maxFlockSize);assert.doesNotMatch(render(pending),/data-row="Инкубатор"/)
 const saturated=reload(f);saturated.eggBaskets=Number.MAX_SAFE_INTEGER
 assert.ok(F.restoreFarm(saturated),'a safe-integer old save can already contain the maximum count')
 const full=structuredClone(saturated);assert.equal(packedShown(saturated),null)
 packedApp(saturated).exec(packedAction,token);assert.deepEqual(saturated,full)
})

test('a current valid old-save rare-only nest is still collectible alongside the ordinary basket, never substituted',()=>{
 // Direct rarity fixture, not claimed as normal Day16 hatchery laying: modern hatcheries have multiple eggs per fed night.
 const legacy=reload(earnedStoredBasket().state);legacy.eggsReady=1;legacy.eggTrait='star'
 assert.ok(F.restoreFarm(legacy),'the preexisting save grammar accepts one rare-only nest')
 assert.match(render(legacy),/data-action="collect" data-value="">/)
 const token=packedShown(legacy)?.[1];assert.ok(token)
 assert.equal(F.getRareIncubatorEgg(legacy),undefined)
 const a=packedApp(legacy);a.exec(packedAction,token)
 assert.deepEqual([legacy.eggsReady,legacy.eggTrait,...packedStock(legacy)],[1,'star',0,1,0,null,1])
 assert.match(incubator(legacy),/data-action="incubator-basket"/)
 assert.ok(legacy.variants.egg?.rainbow===1&&legacy.variants.egg.star===undefined)
 assert.ok(F.collectEggs(legacy).ok)
 assert.deepEqual([legacy.variants.egg?.rainbow,legacy.variants.egg?.star],[1,1])
 assert.match(incubator(legacy),/data-action="incubator-basket"/)
})

test('no crate economy change, compact owner spots the one live control, existing guard prevents repeats',()=>{
 const p=earnedDay16('packing')
 p.act('packEggCrate',{kind:'crate',placements:[{x:-.8,y:0},{x:-.4,y:0},{x:0,y:0},{x:.4,y:0},{x:.8,y:0}],settled:true})
 p.act('transferBayGoods','deposit','home','eggCrates',1)
 const f=p.state
 assert.ok(!F.specializeFacility(f,'hatchery').ok,'installed packing is exclusive with the hatchery')
 assert.doesNotMatch(render(f),/data-row="Инкубатор"|incubator-warehouse-basket/)
 assert.ok(F.restoreFarm(f))
 const incompatible=structuredClone(f);incompatible.coopSpecialization='hatchery'
 assert.equal(getLocalWarehouseSupply(incompatible,{kind:'eggCrates',quantity:1}),undefined,'crate withdrawal into a hatchery save is not a valid existing transfer')
 const cssOwner=readFileSync(new URL('../src/coop-services.ts',import.meta.url),'utf8')
 assert.match(cssOwner,/\[data-action="incubator-warehouse-basket"\]:not\(:disabled\)/)
 assert.ok(isGuardedAction(packedAction));assert.ok(isGuardedAction('unpack-egg-basket'));assert.ok(isGuardedAction('incubate-egg'))
 for(const key of ['Enter',' ']){
   const guard=new ActivationKeyGuard()
   assert.equal(guard.blocks({key,repeat:false},true),false)
   assert.equal(guard.blocks({key,repeat:true},true),true)
   guard.release(key);assert.equal(guard.blocks({key,repeat:false},true),false)
 }
 const once=new ActionClickGuard(),click={detail:1,timeStamp:100,clientX:12,clientY:34}
 once.remember(click);assert.equal(once.blocks({...click,detail:2,timeStamp:160}),true)
})
