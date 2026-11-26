import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import * as F from '../src/farm.ts'
import * as H from '../src/harbour-economy.ts'
import * as M from '../src/bay-freight-model.ts'
import * as E from '../src/ferry-expeditions.ts'
import { nextFerryExploration } from '../src/ferry-discovery.ts'
import { getFerryRestockPlan } from '../src/ferry-restock.ts'
import { smallerFerryCargo } from '../src/ferry-smaller-cargo.ts'
import { ferryProjectProgress } from '../src/ferry-project-progress.ts'
import { getRequirementHint } from '../src/requirement-guidance.ts'
import { isGuardedAction } from '../src/action-click-guard.ts'
import { ruCount } from '../src/ru.ts'
import { commissionPlayer } from './fixtures/commission-player.ts'

const read=(name:string)=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8')
const source=read('main.ts'), view=read('bay-freight-ui.ts')
function between(s:string,a:string,b:string){
 const from=s.indexOf(a),to=s.indexOf(b,from+a.length)
 assert.ok(from>=0&&to>=0,a);return s.slice(from,to)
}
const freightView=stripTypeScriptTypes(
 between(view,'const labels:', '/** DOM entry').replace(/export function /g,'function ').replaceAll('import.meta.env.BASE_URL','"/"')
 + '\nrenderFreightPanel')
const draw=stripTypeScriptTypes('switch(panel){'+between(source,"    case 'bay-freight': {","    case 'intents':")+'}')
const actions=stripTypeScriptTypes(
 between(source,'async function showRequirement(', '// Scene handlers own')
 + 'async function click(action,value,control,event={detail:0}){switch(action){'
 + between(source,"    case 'expedition-source': {","    case 'music-warehouse-visit': {") + '}}; click')
function earned(ready=true){
 const p=commissionPlayer([])
 p.act('workBed',2);p.act('sellMarketItem','produce:cabbage',2);p.act('buyBoat')
 if(ready){p.act('workBed',11);p.night()}
 p.act('workBed',4)
 assert.equal(p.state.produce.wheat,3)
 if(ready)assert.deepEqual([p.actions,p.state.day,p.state.coins,F.getBedHarvestPreview(p.state,11)?.ordinary],[6,2,7,3])
 return p
}
function panel(farm:F.FarmState,offer='mill-grain'){
 const events:unknown[]=[], writes:F.FarmState[]=[]
 const render=runInNewContext(freightView,{...E,...M,ruCount,nextFerryExploration,getFerryRestockPlan,smallerFerryCargo,ferryProjectProgress})
 const host={html:'',querySelector(){return null}}
 const x:any={ ...F,...H,...M,...E,getRequirementHint,farm,
  panel:'bay-freight',dialog:{open:true},selectedExpeditionPort:'mill',selectedExpeditionOffer:offer,selectedWarehouse:farm.island,
  freightPlanOpen:false,dialogContent:host,ferryCommissionUse:()=>undefined,ferryPeachPlanting:{current:()=>undefined,receive:H.receiveFerryExpedition},
  harbourGoods:()=>Object.entries(H.expeditionWallet(farm).bag).map(([id,quantity])=>({id,quantity,name:id==='wheat'?'Пшеница':id==='handmade:round'?'Булочка':id})),
  renderFreightPanelInto(_host:unknown,state:M.BayFreightState,ctx:unknown){host.html=render(state,ctx)},
  island:{focusTarget(target:unknown){events.push(structuredClone(target))},isCrossing(){return false},crossIsland(){throw Error('no travel for local wheat')}},
  closeDialog(){x.panel=undefined;x.dialog.open=false;events.push('close')},
  fieldViewButton:{getAttribute:()=> 'false'},toggleFieldView(){throw Error('not in field view')},
  icon:()=>'',presentFerryDeparture:()=>{},bayAudio:{playEvent:()=>{}},notify:()=>{},document:{activeElement:null},
  perform(fn:()=>{ok:boolean}){
   const result=fn()
   if(result.ok){writes.push(structuredClone(farm)); x.drawPanel()}
   return result.ok
  },
  drawPanel(){runInNewContext(draw,x)},
 }
 const click=runInNewContext(actions,x)
 const read=()=>{x.drawPanel();return host.html}
 const open=()=>{x.panel='bay-freight';x.dialog.open=true;return read()}
 const go=(a:string,v?:string)=>click(a,v,{dataset:{action:a,value:v}})
 return {x,read,events,writes,open,go}
}
function footer(s:string){return between(s,'<footer class="expedition-departure">','</footer>')}
function display(s:string,action:string){
 return [...s.matchAll(/<button type="button" data-action="([^"]+)" data-value="([^"]*)" ([^>]*)>([^<]+)/gu)]
  .filter(([,id])=>id===action).map(([,id,value,extra,label])=>({id,value,extra,label}))
}

test('Day 2 can stay with the selected baker order and harvest, or take a smaller trade now',async t=>{
 const p=earned(), farm=p.state, h=panel(farm)
 assert.deepEqual(E.initialExpeditionPreview(farm.freight.expeditions),{port:'mill',offer:'mill-grain'})
 const requirement=H.getFerrySupplyRequirement(farm,'mill-grain','wheat')!
 const hint=getRequirementHint(farm,requirement).action
 assert.deepEqual([hint.target,hint.value],['focus-bed','11'])
 const start=footer(h.read()),before=structuredClone(farm)
 assert.equal(footer(h.read()),start);assert.deepEqual(farm,before)
 const smaller=display(start,'expedition-offer')
 assert.deepEqual(smaller.map(row=>row.value),['mill-sale'])
 const harvest=display(start,'expedition-source').find(row=>row.value.includes('|harvest:'))
 t.diagnostic(JSON.stringify({day:farm.day,earnedActions:p.actions,bagWheat:3,ripeBed:11,wheatIfPicked:6,selected:h.x.selectedExpeditionOffer,
  visibleShortTrade:smaller[0]?.value??null,visibleOriginalSupply:harvest?.value??null}))
 assert.ok(harvest,'one ordinary available harvest should be visible beside the shorter trade')
 assert.match(harvest.extra,/bay-freight-primary/u);assert.match(harvest.label,/К урожаю: пшеница.*3/u)
 assert.ok(start.indexOf('expedition-source')<start.indexOf('expedition-offer'))
 assert.equal(isGuardedAction('expedition-source'),true)
 await h.go('expedition-source',harvest.value)
 assert.deepEqual(h.events,['close',{kind:'bed',index:11}]);assert.deepEqual(farm,before)
 assert.equal(h.writes.length,0);assert.equal(h.x.selectedExpeditionOffer,'mill-grain')
 assert.ok(F.workBed(farm,11).ok,'a separate harvest owns crop and goal changes')
 assert.equal(farm.produce.wheat,6)
 assert.equal(h.x.selectedExpeditionOffer,'mill-grain')
 const send=display(footer(h.open()),'expedition-send')[0]
 assert.equal(send.value,'mill-grain');assert.doesNotMatch(send.extra,/disabled/)
 assert.equal(farm.freight.expeditions.active,null)
 const coinsAfterHarvest=farm.coins
 await h.go('expedition-send',send.value);await h.go('expedition-send',send.value)
 assert.equal(h.writes.length,1);assert.equal(farm.produce.wheat,2);assert.equal(farm.coins,coinsAfterHarvest)
 assert.deepEqual([farm.freight.expeditions.active?.id,farm.freight.expeditions.active?.phase,farm.handmade.round],['mill-grain','sailing',0])
 assert.ok(F.endDay(farm).ok)
 await h.go('expedition-claim');await h.go('expedition-claim')
 assert.equal(h.writes.length,2);assert.equal(farm.handmade.round,1);assert.equal(farm.coins,coinsAfterHarvest+5)

 const quick=earned().state, q=panel(quick)
 q.read();const still=structuredClone(quick)
 await q.go('expedition-offer',smaller[0].value)
 assert.deepEqual(quick,still);assert.equal(q.writes.length,0)
 const direct=display(footer(q.read()),'expedition-send')[0]
 assert.equal(direct.value,'mill-sale');assert.doesNotMatch(direct.extra,/disabled/)
 await q.go('expedition-send',direct.value);assert.equal(quick.produce.wheat,1)
 assert.ok(F.endDay(quick).ok);await q.go('expedition-claim')
 assert.equal(quick.handmade.round,0);assert.equal(quick.coins,17)
 assert.equal(F.getBedHarvestPreview(quick,11)?.ordinary,3)
 t.diagnostic(JSON.stringify({chosenAfterHarvest:{coins:farm.coins,wheat:farm.produce.wheat,buns:farm.handmade.round,paidDispatches:1,paidClaims:1},quickAlternative:{coins:quick.coins,wheat:quick.produce.wheat,buns:quick.handmade.round,ripeWheatStillOnBed:3}}))
})

test('a paired order is only promised if a single ordinary harvest really completes its live quote',()=>{
 const farm=earned().state
 const pair=E.combinedExpeditionId('mill-grain','mill-sale')!
 const ready=footer(panel(farm,pair).read())
 assert.ok(display(ready,'expedition-source').some(row=>row.value.startsWith(pair+'|wheat|harvest:')))
 assert.equal(display(ready,'expedition-offer')[0].value,'mill-sale')
 const blocked=E.combinedExpeditionId('mill-grain','mill-eggs')!
 const prohibited=E.combinedExpeditionId('mill-grain','mill-baking')!
 for(const [stock,id] of [[farm,blocked],[farm,prohibited],[earned(false).state,'mill-grain']] as const){
  const no=footer(panel(stock,id).read())
  assert.equal(display(no,'expedition-source').some(row=>row.value.includes('|harvest:')),false)
  assert.ok(display(no,'expedition-offer').some(row=>row.value==='mill-sale'))
 }
 const abroad=earned();abroad.visit('grove')
 assert.equal(display(footer(panel(abroad.state).read()),'expedition-source').some(row=>row.value.includes('|harvest:')),false)
})

test('a harvest shortcut cannot steal another quote, day, island, closed review or now-ready voyage',async()=>{
 for(const branch of ['manual selection','overnight','foreign island','closed','gathered already','voyage sailing']){
  const farm=earned().state,h=panel(farm)
  const row=display(footer(h.read()),'expedition-source').find(row=>row.value.includes('|harvest:'))
  assert.ok(row)
  if(branch==='manual selection')await h.go('expedition-offer','mill-sale')
  if(branch==='overnight')assert.ok(F.endDay(farm).ok)
  if(branch==='foreign island')assert.ok(F.sail(farm,'grove').ok)
  if(branch==='closed')h.x.dialog.open=false
  if(branch==='gathered already')assert.ok(F.workBed(farm,11).ok)
  if(branch==='voyage sailing')assert.ok(H.sendFerryExpedition(farm,'mill-sale').ok)
  const before=structuredClone(farm)
  await h.go('expedition-source',row.value)
  assert.deepEqual(h.events,[],branch);assert.deepEqual(farm,before,branch);assert.equal(h.writes.length,0)
 }
})
